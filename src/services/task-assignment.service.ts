/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { prisma } from '@/utils/prisma';
import { Priority, Status } from '@prisma/client';
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils'; // Removed shiftUserTasks import here
import { TASK_ASSIGNMENT_THRESHOLDS, CACHE_KEYS, WORK_HOURS } from '@/config';
import { getFromCache, setInCache } from '@/utils/cache';
import usHolidays from '@/data/usHolidays.json'

function getUSHolidays(startDate: Date, endDate: Date): Date[] {
  const holidays: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  usHolidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date + 'T00:00:00Z');
    if (holidayDate >= start && holidayDate <= end) {
      holidays.push(holidayDate);
    }
  });
  
  return holidays;
}

function calculateWorkingDaysBetween(startDate: Date, endDate: Date, excludeVacations: UserVacation[] = []): number {
  if (startDate >= endDate) return 0;
  
  let workingDays = 0;
  const current = new Date(startDate);
  const holidays = getUSHolidays(startDate, endDate);
  
  while (current < endDate) {
    const dayOfWeek = current.getUTCDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const isHoliday = holidays.some(holiday => 
        holiday.toISOString().split('T')[0] === current.toISOString().split('T')[0]
      );
      
      const isOnVacation = excludeVacations.some(vacation => {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        return current >= vacStart && current <= vacEnd;
      });
      
      if (!isHoliday && !isOnVacation) {
        workingDays++;
      }
    }
    
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return workingDays;
}

function checkVacationConflict(
  taskStart: Date, 
  taskEnd: Date, 
  vacations: UserVacation[]
): { hasConflict: boolean; conflictingVacation?: UserVacation } {
  for (const vacation of vacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);
    
    if (taskStart <= vacEnd && taskEnd >= vacStart) {
      return { hasConflict: true, conflictingVacation: vacation };
    }
  }
  
  return { hasConflict: false };
}

async function getNextAvailableStartAfterVacations(
  baseDate: Date, 
  vacations: UserVacation[]
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);
  
  for (const vacation of vacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);
    
    if (availableDate >= vacStart && availableDate <= vacEnd) {
      const dayAfterVacation = new Date(vacEnd);
      dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
      availableDate = await getNextAvailableStart(dayAfterVacation);
    }
  }
  
  return availableDate;
}

export async function findCompatibleUsers(typeId: number, brandId: string): Promise<UserWithRoles[]> {
  // The cache key still includes brandId because compatibility can depend on brand-specific roles
  const cacheKey = `${CACHE_KEYS.COMPATIBLE_USERS_PREFIX}${typeId}-${brandId}`;
  const compatibleUsers = getFromCache<UserWithRoles[]>(cacheKey);

  if (compatibleUsers) {
    return compatibleUsers;
  }

  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId }, // Keep brandId filter for roles as compatibility can be brand-specific
            { brandId: null }
          ]
        }
      },
    },
  });

  const filteredUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  ) as UserWithRoles[];

  setInCache(cacheKey, filteredUsers);
  return filteredUsers;
}

export async function calculateUserSlots(
  users: UserWithRoles[],
  typeId: number,
  brandId: string // Keep brandId in signature, but it's not used for task filtering here
): Promise<UserSlot[]> {
  const userIdsSorted = users.map(u => u.id).sort().join('-');
  // The cache key should reflect that tasks are no longer filtered by brand for queue calculation
  const cacheKey = `${CACHE_KEYS.USER_SLOTS_PREFIX}${typeId}-${userIdsSorted}`; // Removed brandId from cache key
  const cachedUserSlots = getFromCache<UserSlot[]>(cacheKey);

  if (cachedUserSlots) {
    return cachedUserSlots;
  }

  const userIds = users.map(user => user.id);

  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId, // Filter by typeId only
      // REMOVED: brandId: brandId, // No longer filtering by brand for queue calculation
      status: {
        notIn: [Status.COMPLETE]
      },
      assignees: {
        some: {
          userId: { in: userIds }
        }
      }
    },
    orderBy: { queuePosition: 'asc' },
    include: {
      category: { include: { type: true } },
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  for (const userId in tasksByUser) {
    tasksByUser[userId].sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const resultSlots = await Promise.all(users.map(async (user) => {
    const userTasks = tasksByUser[user.id] || [];
    const cargaTotal = userTasks.length;

    let availableDate: Date;
    let lastTaskDeadline: Date | undefined;

    if (userTasks.length > 0) {
      const lastTask = userTasks[userTasks.length - 1];
      availableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      lastTaskDeadline = new Date(lastTask.deadline);
    } else {
      availableDate = await getNextAvailableStart(new Date());
    }

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    return {
      userId: user.id,
      userName: user.name,
      availableDate,
      tasks: userTasks,
      cargaTotal,
      isSpecialist,
      lastTaskDeadline,
    };
  }));

  setInCache(cacheKey, resultSlots);
  return resultSlots;
}

async function getVacationAwareUserSlots(
  typeId: number, 
  brandId: string, // Keep brandId in signature, but it's not used for task filtering here
  taskDurationDays: number
): Promise<VacationAwareUserSlot[]> {
  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId }, // Keep brandId filter for roles as compatibility can be brand-specific
            { brandId: null }
          ]
        }
      },
      vacations: {
        where: {
          endDate: {
            gte: new Date()
          }
        }
      }
    },
  });

  const compatibleUsers = allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  );

  const userIds = compatibleUsers.map(user => user.id);
  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId, // Filter by typeId only
      // REMOVED: brandId: brandId, // No longer filtering by brand for queue calculation
      status: {
        notIn: [Status.COMPLETE]
      },
      assignees: {
        some: {
          userId: { in: userIds }
        }
      }
    },
    orderBy: { queuePosition: 'asc' },
    include: {
      category: { include: { type: true } },
      type: true,
      brand: true,
      assignees: { include: { user: true } }
    },
  }) as unknown as Task[];

  const tasksByUser: Record<string, Task[]> = {};
  for (const task of allRelevantTasks) {
    for (const assignee of task.assignees) {
      if (userIds.includes(assignee.userId)) {
        if (!tasksByUser[assignee.userId]) {
          tasksByUser[assignee.userId] = [];
        }
        tasksByUser[assignee.userId].push(task);
      }
    }
  }

  for (const userId in tasksByUser) {
    tasksByUser[userId].sort((a, b) => a.queuePosition - b.queuePosition);
  }

  const vacationAwareSlots: VacationAwareUserSlot[] = [];
  
  for (const user of compatibleUsers) {
    const userTasks = tasksByUser[user.id] || [];
    userTasks.sort((a, b) => a.queuePosition - b.queuePosition);

    let baseAvailableDate: Date;
    if (userTasks.length > 0) {
      const lastTask = userTasks[userTasks.length - 1];
      baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
    } else {
      baseAvailableDate = await getNextAvailableStart(new Date());
    }

    const upcomingVacations: UserVacation[] = user.vacations.map(v => ({
      id: v.id,
      userId: v.userId,
      startDate: new Date(v.startDate),
      endDate: new Date(v.endDate)
    }));

    const potentialTaskStart = await getNextAvailableStartAfterVacations(
      baseAvailableDate, 
      upcomingVacations
    );

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = await calculateWorkingDeadline(potentialTaskStart, taskHours);

    const vacationConflict = checkVacationConflict(
      potentialTaskStart, 
      potentialTaskEnd, 
      upcomingVacations
    );

    const workingDaysUntilAvailable = calculateWorkingDaysBetween(
      new Date(),
      potentialTaskStart,
      upcomingVacations
    );

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    const vacationAwareSlot: VacationAwareUserSlot = {
      userId: user.id,
      userName: user.name,
      availableDate: potentialTaskStart,
      tasks: userTasks,
      cargaTotal: userTasks.length,
      isSpecialist,
      lastTaskDeadline: userTasks.length > 0 ? new Date(userTasks[userTasks.length - 1].deadline) : undefined,
      upcomingVacations,
      potentialTaskStart,
      potentialTaskEnd,
      hasVacationConflict: vacationConflict.hasConflict,
      workingDaysUntilAvailable,
      vacationConflictDetails: vacationConflict.hasConflict ? {
        conflictingVacation: vacationConflict.conflictingVacation!,
        daysSavedByWaiting: 0
      } : undefined
    };

    vacationAwareSlots.push(vacationAwareSlot);
  }

  return vacationAwareSlots;
}

async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[]
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) return null;

  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  const sortedEligibleSpecialists = specialists.filter(s => !s.hasVacationConflict).sort((a, b) => {
    if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
    return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
  });

  const sortedVacationSpecialists = specialists.filter(s => s.hasVacationConflict).sort((a, b) => {
    if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
    return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
  });

  const sortedGeneralists = generalists.filter(g => !g.hasVacationConflict).sort((a, b) => {
    if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
    return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
  });

  const bestSpecialist = sortedEligibleSpecialists.length > 0 ? sortedEligibleSpecialists[0] : null;
  const bestVacationSpecialist = sortedVacationSpecialists.length > 0 ? sortedVacationSpecialists[0] : null;
  const bestGeneralist = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null;

  // Prioridad 1: Especialistas elegibles sin conflicto de vacaciones
  if (bestSpecialist) {
    if (bestGeneralist) {
      const deadlineDifferenceDays = bestSpecialist.workingDaysUntilAvailable - bestGeneralist.workingDaysUntilAvailable;
      if (deadlineDifferenceDays > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
        return bestGeneralist;
      }
    }
    return bestSpecialist;
  }

  // Prioridad 2: Especialistas con conflicto de vacaciones (si la espera no es excesiva)
  if (bestVacationSpecialist) {
    if (bestGeneralist) {
      const daysBenefit = bestVacationSpecialist.workingDaysUntilAvailable - bestGeneralist.workingDaysUntilAvailable;
      if (bestVacationSpecialist.workingDaysUntilAvailable > 10 && daysBenefit >= 5) {
        return bestGeneralist;
      }
    }
    return bestVacationSpecialist;
  }

  // Prioridad 3: Generalistas elegibles sin conflicto de vacaciones
  if (bestGeneralist) {
    return bestGeneralist;
  }

  // Si no hay nadie elegible, retornar el que tenga menos carga o esté disponible antes, incluso con conflicto
  // Esto es un fallback para asegurar que siempre se intente asignar a alguien si hay usuarios
  const allUsersSorted = userSlots.sort((a, b) => {
    if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
    return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
  });

  return allUsersSorted.length > 0 ? allUsersSorted[0] : null;
}

export function selectBestUser(userSlots: UserSlot[]): UserSlot | null {
  const specialists = userSlots.filter(slot => slot.isSpecialist)
  const generalists = userSlots.filter(slot => !slot.isSpecialist)

  const sortUsers = (users: UserSlot[]) => {
    return users.sort((a, b) => {
      if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal
      return a.availableDate.getTime() - b.availableDate.getTime()
    })
  }

  const sortedSpecialists = sortUsers(specialists)
  const sortedGeneralists = sortUsers(generalists)

  const bestSpecialist: UserSlot | null = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null
  const bestGeneralist: UserSlot | null = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null

  if (!bestSpecialist) {
    return bestGeneralist;
  }
  if (!bestGeneralist) {
    return bestSpecialist;
  }

  let effectiveSpecialistDeadline: Date;
  if (bestSpecialist.tasks.length > 0 && bestSpecialist.lastTaskDeadline) {
    effectiveSpecialistDeadline = bestSpecialist.lastTaskDeadline;
  } else {
    effectiveSpecialistDeadline = bestSpecialist.availableDate;
  }

  let effectiveGeneralistDeadline: Date;
  if (bestGeneralist.tasks.length > 0 && bestGeneralist.lastTaskDeadline) {
    effectiveGeneralistDeadline = bestGeneralist.lastTaskDeadline;
  } else {
    effectiveGeneralistDeadline = bestGeneralist.availableDate;
  }

  const deadlineDifferenceDays = (effectiveSpecialistDeadline.getTime() - effectiveGeneralistDeadline.getTime()) / (1000 * 60 * 60 * 24);

  if (deadlineDifferenceDays > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
    return bestGeneralist;
  }

  return bestSpecialist;
}

export async function getBestUserWithCache(
  typeId: number, 
  brandId: string, 
  priority: Priority,
  durationDays?: number
): Promise<UserSlot | null> {
  
  // The cache key now reflects that task queue calculations are global, but user compatibility still depends on brand.
  // The `brandId` is still needed for `findCompatibleUsers` and `getVacationAwareUserSlots` roles filter.
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}-vacation-${durationDays || 'no-duration'}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    return bestSlot;
  }

  // These functions will now fetch all relevant tasks for a user, regardless of brand,
  // but still filter compatible users based on brand roles.
  const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays || 0);
  const bestVacationSlot = await selectBestUserWithVacationLogic(vacationAwareSlots);
  
  if (!bestVacationSlot) {
    setInCache(cacheKey, null);
    return null;
  }
  
  const compatibleSlot: UserSlot = {
    userId: bestVacationSlot.userId,
    userName: bestVacationSlot.userName,
    availableDate: bestVacationSlot.availableDate,
    tasks: bestVacationSlot.tasks,
    cargaTotal: bestVacationSlot.cargaTotal,
    isSpecialist: bestVacationSlot.isSpecialist,
    lastTaskDeadline: bestVacationSlot.lastTaskDeadline
  };

  setInCache(cacheKey, compatibleSlot);
  return compatibleSlot;
}

interface QueueAnalysis {
  urgentCount: number
  highCount: number
  normalCount: number
  lowCount: number
  lastUrgentIndex: number
  lastHighIndex: number
  firstNormalIndex: number
  firstLowIndex: number
}

function analyzeQueueByPriority(tasks: Task[]): QueueAnalysis {
  const analysis: QueueAnalysis = {
    urgentCount: 0,
    highCount: 0,
    normalCount: 0,
    lowCount: 0,
    lastUrgentIndex: -1,
    lastHighIndex: -1,
    firstNormalIndex: -1,
    firstLowIndex: -1,
    nonUrgentHighCount: 0,
    nonUrgentNormalCount: 0
  }

  tasks.forEach((task, index) => {
    switch (task.priority) {
      case 'URGENT':
        analysis.urgentCount++
        analysis.lastUrgentIndex = index
        break
      case 'HIGH':
        analysis.highCount++
        analysis.lastHighIndex = index
        // Solo contar HIGH después de la zona URGENT
        if (analysis.lastUrgentIndex === -1 || index > analysis.lastUrgentIndex) {
          analysis.nonUrgentHighCount++
        }
        break
      case 'NORMAL':
        analysis.normalCount++
        if (analysis.firstNormalIndex === -1) {
          analysis.firstNormalIndex = index
        }
        // Solo contar NORMAL después de la zona URGENT
        if (analysis.lastUrgentIndex === -1 || index > analysis.lastUrgentIndex) {
          analysis.nonUrgentNormalCount++
        }
        break
      case 'LOW':
        analysis.lowCount++
        if (analysis.firstLowIndex === -1) {
          analysis.firstLowIndex = index
        }
        break
    }
  })

  return analysis
}

function isLowTaskInWaitingPeriod(task: Task): boolean {
  const now = new Date();
  const taskCreationTime = new Date(task.createdAt);
  
  const workingHoursElapsed = calculateWorkingHoursBetween(taskCreationTime, now);
  
  return workingHoursElapsed < 8;
}

function calculateWorkingHoursBetween(startDate: Date, endDate: Date): number {
  let totalHours = 0;
  const current = new Date(startDate);
  
  while (current < endDate) {
    const day = current.getUTCDay();
    
    if (day === 0 || day === 6) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }
    
    const dayStart = new Date(current);
    dayStart.setUTCHours(WORK_HOURS.START, 0, 0, 0);
    
    const dayEnd = new Date(current);
    dayEnd.setUTCHours(WORK_HOURS.END, 0, 0, 0);
    
    if (current < dayStart) {
      current.setTime(dayStart.getTime());
    }
    
    if (current >= dayEnd) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }
    
    const effectiveEndTime = endDate < dayEnd ? endDate : dayEnd;
    
    const lunchStart = new Date(current);
    lunchStart.setUTCHours(WORK_HOURS.LUNCH_START, 0, 0, 0);
    
    const lunchEnd = new Date(current);
    lunchEnd.setUTCHours(WORK_HOURS.LUNCH_END, 0, 0, 0);
    
    if (current < lunchStart) {
      const beforeLunchEnd = effectiveEndTime < lunchStart ? effectiveEndTime : lunchStart;
      totalHours += (beforeLunchEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
      
      if (effectiveEndTime > lunchEnd && beforeLunchEnd >= lunchStart) {
        const afterLunchStart = effectiveEndTime < lunchEnd ? effectiveEndTime : lunchEnd;
        totalHours += (effectiveEndTime.getTime() - afterLunchStart.getTime()) / (1000 * 60 * 60);
      }
    } else if (current >= lunchEnd) {
      totalHours += (effectiveEndTime.getTime() - current.getTime()) / (1000 * 60 * 60);
    }
    
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
  }
  
  return totalHours;
}

async function calculateNormalPriorityPosition(userSlot: UserSlot): Promise<number> {
  // Los NORMAL van al final natural, después de toda la lógica de intercalado
  // Pero respetando las reglas con LOW
  
  let insertAt = userSlot.tasks.length // Por defecto al final

  // Buscar posición respetando lógica con LOW (mantener lógica existente)
  for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
    const currentTask = userSlot.tasks[i]

    if (currentTask.priority === 'LOW') {
      // Aplicar lógica existente para LOW
      let normalTasksBeforeThisLow = 0
      for (let j = 0; j < i; j++) {
        if (userSlot.tasks[j].priority === 'NORMAL') {
          normalTasksBeforeThisLow++
        }
      }

      if (normalTasksBeforeThisLow < TASK_ASSIGNMENT_THRESHOLDS.NORMAL_TASKS_BEFORE_LOW_THRESHOLD) {
        insertAt = i
        break
      }
      insertAt = i + 1
    }
  }

  return insertAt
}

async function calculateLowPriorityPosition(userSlot: UserSlot): Promise<QueueCalculationResult> {
  let insertAt = userSlot.tasks.length
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  let lastLowInWaitingPeriodIndex = -1
  
  for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
    const task = userSlot.tasks[i]
    if (task.priority === 'LOW' && isLowTaskInWaitingPeriod(task)) {
      lastLowInWaitingPeriodIndex = i
      break
    }
  }

  if (lastLowInWaitingPeriodIndex !== -1) {
    insertAt = lastLowInWaitingPeriodIndex + 1
  } else {
    let consecutiveLowCount = 0
    for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
      if (userSlot.tasks[i].priority === 'LOW') {
        consecutiveLowCount++
      } else {
        break
      }
    }

    if (consecutiveLowCount < TASK_ASSIGNMENT_THRESHOLDS.CONSECUTIVE_LOW_TASKS_THRESHOLD) {
      insertAt = userSlot.tasks.length
    } else {
      insertAt = userSlot.tasks.length - consecutiveLowCount
    }
  }

  calculatedStartDate = userSlot.availableDate

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

export async function calculateQueuePosition(userSlot: UserSlot, priority: Priority): Promise<QueueCalculationResult> {
  let insertAt = 0
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  const queueAnalysis = analyzeQueueByPriority(userSlot.tasks)

  switch (priority) {
    case 'URGENT':
      insertAt = queueAnalysis.lastUrgentIndex + 1
      
      // ✅ CORRECCIÓN: Calcular fecha basada en la posición de inserción
      if (insertAt === 0) {
        // Si es la primera URGENT, empieza ahora
        calculatedStartDate = await getNextAvailableStart(new Date())
      } else {
        // Si va después de otras URGENT, empieza cuando termina la URGENT anterior
        const previousTask = userSlot.tasks[insertAt - 1]
        calculatedStartDate = await getNextAvailableStart(new Date(previousTask.deadline))
      }
      
      affectedTasks.push(...userSlot.tasks.slice(insertAt))
      break

    case 'HIGH':
      insertAt = calculateHighInterleavedPosition(userSlot.tasks, queueAnalysis)
      
      // ✅ La lógica de HIGH ya está correcta
      if (insertAt === 0) {
        calculatedStartDate = await getNextAvailableStart(new Date())
      } else {
        const previousTask = userSlot.tasks[insertAt - 1]
        calculatedStartDate = await getNextAvailableStart(new Date(previousTask.deadline))
      }
      
      affectedTasks.push(...userSlot.tasks.slice(insertAt))
      break

    case 'NORMAL':
      insertAt = await calculateNormalPriorityPosition(userSlot)
      calculatedStartDate = userSlot.availableDate
      break

    case 'LOW':
      return await calculateLowPriorityPosition(userSlot)

    default:
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate
  }

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

function calculateHighInterleavedPosition(tasks: Task[], queueAnalysis: QueueAnalysis): number {
  // Si no hay tareas, HIGH va en posición 0
  if (tasks.length === 0) {
    return 0
  }

  // Si solo hay URGENT, HIGH va después de todos los URGENT
  if (queueAnalysis.urgentCount === tasks.length) {
    return queueAnalysis.lastUrgentIndex + 1
  }

  // Buscar la zona no-URGENT para intercalar (después de todos los URGENT)
  const nonUrgentStartIndex = queueAnalysis.lastUrgentIndex + 1
  
  // Si no hay URGENT, empezamos desde el inicio
  const startIndex = queueAnalysis.urgentCount > 0 ? nonUrgentStartIndex : 0
  
  // Contar HIGH existentes después de los URGENT para saber qué posición toca
  let existingHighCount = 0
  for (let i = startIndex; i < tasks.length; i++) {
    if (tasks[i].priority === 'HIGH') {
      existingHighCount++
    }
  }

  // La nueva HIGH debe ir en la posición: (existingHighCount + 1)
  // Esto significa que si hay 0 HIGH, va en posición 1 (después del primer NORMAL)
  // Si hay 1 HIGH, va en posición 3 (después del segundo NORMAL), etc.
  const targetPosition = existingHighCount + 1

  // Contar NORMAL desde el inicio de la zona no-URGENT
  let normalCount = 0
  
  for (let i = startIndex; i < tasks.length; i++) {
    // Si encontramos un NORMAL, incrementar el contador
    if (tasks[i].priority === 'NORMAL') {
      normalCount++
      
      // Si hemos visto suficientes NORMAL para nuestra posición objetivo
      if (normalCount === targetPosition) {
        // Insertar después de este NORMAL
        return i + 1
      }
    }
  }

  // Si no hay suficientes NORMAL para el patrón, insertar al final
  return tasks.length
}

/**
 * ✅ FUNCIÓN AUXILIAR MEJORADA: Analiza la cola con más detalle
 */
interface QueueAnalysis {
  urgentCount: number
  highCount: number
  normalCount: number
  lowCount: number
  lastUrgentIndex: number
  lastHighIndex: number
  firstNormalIndex: number
  firstLowIndex: number
  // Nuevos campos para patrón cebra
  nonUrgentHighCount: number  // HIGH después de los URGENT
  nonUrgentNormalCount: number // NORMAL después de los URGENT
}

export async function processUserAssignments(
  usersToAssign: string[],
  userSlots: UserSlot[],
  priority: Priority,
  durationDays: number,
  brandId: string // Keep brandId in signature, it's used for compatibility checks
): Promise<TaskTimingResult> {
  const numberOfAssignees = usersToAssign.length
  const effectiveDuration = durationDays / numberOfAssignees
  const newTaskHours = effectiveDuration * 8

  let earliestStartDate = new Date()
  let latestDeadline = new Date()
  let primaryInsertAt = 0

  for (const userId of usersToAssign) {
    const userSlot = userSlots.find(slot => slot.userId === userId)

    if (!userSlot) {
      continue
    }

    const queueResult = await calculateQueuePosition(userSlot, priority)

    const userStartDate = queueResult.calculatedStartDate
    const userDeadline = await calculateWorkingDeadline(userStartDate, newTaskHours)

    // REMOVED: This block performs the premature shifting.
    // if (queueResult.affectedTasks.length > 0) {
    //   await shiftUserTasks(userSlot.userId, 'temp-new-task-id', userDeadline, queueResult.insertAt);
    // }

    if (userId === usersToAssign[0]) {
      earliestStartDate = userStartDate
      latestDeadline = userDeadline
      primaryInsertAt = queueResult.insertAt
    } else {
      if (userStartDate < earliestStartDate) {
        earliestStartDate = userStartDate
      }
      if (userDeadline > latestDeadline) {
        latestDeadline = userDeadline
      }
    }
  }

  return {
    startDate: earliestStartDate,
    deadline: latestDeadline,
    insertAt: primaryInsertAt
  }
}

export async function getTaskHours(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      category: true,
      type: true,
      assignees: {
        include: {
          user: true
        }
      }
    },
  });

  if (!task) throw new Error('Tarea no encontrada');
  if (!task.assignees.length) throw new Error('Tarea sin asignaciones');

  return task.category.duration * 8;
}