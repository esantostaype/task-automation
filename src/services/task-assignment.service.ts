/* eslint-disable prefer-const */
// src/services/task-assignment.service.ts - VERSIÓN COMPLETA CON LÓGICA DE VACACIONES

import { prisma } from '@/utils/prisma';
import { Priority, Status } from '@prisma/client';
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult, UserVacation, VacationAwareUserSlot } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline, shiftUserTasks } from '@/utils/task-calculation-utils';
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

/**
 * Calcula días laborales entre dos fechas considerando festivos y vacaciones
 */
function calculateWorkingDaysBetween(startDate: Date, endDate: Date, excludeVacations: UserVacation[] = []): number {
  if (startDate >= endDate) return 0;
  
  let workingDays = 0;
  const current = new Date(startDate);
  const holidays = getUSHolidays(startDate, endDate);
  
  while (current < endDate) {
    const dayOfWeek = current.getUTCDay();
    
    // Excluir fines de semana
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Verificar si no es día festivo
      const isHoliday = holidays.some(holiday => 
        holiday.toISOString().split('T')[0] === current.toISOString().split('T')[0]
      );
      
      // Verificar si no está en vacaciones
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

/**
 * Verifica si una tarea se solapará con vacaciones
 */
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

/**
 * Calcula la próxima fecha disponible después de vacaciones
 */
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

// ✅ FUNCIONES PRINCIPALES

export async function findCompatibleUsers(typeId: number, brandId: string): Promise<UserWithRoles[]> {
  const cacheKey = `${CACHE_KEYS.COMPATIBLE_USERS_PREFIX}${typeId}-${brandId}`;
  const compatibleUsers = getFromCache<UserWithRoles[]>(cacheKey);

  if (compatibleUsers) {
    console.log(`Cache hit for compatible users: ${cacheKey}`);
    return compatibleUsers;
  }
  console.log(`Cache miss for compatible users: ${cacheKey}, calculating...`);

  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
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
  brandId: string
): Promise<UserSlot[]> {
  const userIdsSorted = users.map(u => u.id).sort().join('-');
  const cacheKey = `${CACHE_KEYS.USER_SLOTS_PREFIX}${typeId}-${brandId}-${userIdsSorted}`;
  const cachedUserSlots = getFromCache<UserSlot[]>(cacheKey);

  if (cachedUserSlots) {
    console.log(`Cache hit for userSlots: ${cacheKey}`);
    return cachedUserSlots;
  }
  console.log(`Cache miss for userSlots: ${cacheKey}, calculating...`);

  const userIds = users.map(user => user.id);

  const allRelevantTasks = await prisma.task.findMany({
    where: {
      typeId: typeId,
      brandId: brandId,
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

/**
 * ✅ NUEVA FUNCIÓN: Obtiene usuarios compatibles con información de vacaciones
 */
async function getVacationAwareUserSlots(
  typeId: number, 
  brandId: string, 
  taskDurationDays: number
): Promise<VacationAwareUserSlot[]> {
  const allUsersWithRoles = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
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
      typeId: typeId,
      brandId: brandId,
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

/**
 * ✅ FUNCIÓN PRINCIPAL: Selecciona el mejor usuario usando la nueva lógica de vacaciones
 */
async function selectBestUserWithVacationLogic(
  userSlots: VacationAwareUserSlot[]
): Promise<VacationAwareUserSlot | null> {
  if (userSlots.length === 0) return null;

  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  const eligibleSpecialists = specialists.filter(s => !s.hasVacationConflict);
  const vacationSpecialists = specialists.filter(s => s.hasVacationConflict);

  console.log('🎯 === ANÁLISIS DE ASIGNACIÓN CON VACACIONES ===');
  console.log(`📊 Especialistas elegibles: ${eligibleSpecialists.length}`);
  console.log(`🏖️ Especialistas en vacaciones: ${vacationSpecialists.length}`);
  console.log(`🔄 Generalistas: ${generalists.length}`);

  // ✅ PRIORIDAD 1: Mejor Especialista Elegible (Sin Vacaciones Cercanas)
  if (eligibleSpecialists.length > 0) {
    const sortedEligibleSpecialists = eligibleSpecialists.sort((a, b) => {
      if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
      return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
    });

    const bestSpecialist = sortedEligibleSpecialists[0];
    
    // ✅ USAR LÓGICA EXISTENTE: Comparar diferencia de deadlines
    const availableGeneralists = generalists.filter(g => !g.hasVacationConflict);
    if (availableGeneralists.length > 0) {
      const bestGeneralist = availableGeneralists.sort((a, b) => {
        if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
        return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
      })[0];

      const deadlineDifferenceDays = bestSpecialist.workingDaysUntilAvailable - bestGeneralist.workingDaysUntilAvailable;
      
      if (deadlineDifferenceDays > TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
        console.log(`✅ Generalista ${bestGeneralist.userName} FORZADO sobre especialista ${bestSpecialist.userName}. Deadline del especialista es más de ${TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST} días más lejano. Diferencia: ${deadlineDifferenceDays} días.`);
        return bestGeneralist;
      }
    }
    
    console.log(`✅ Asignando a especialista elegible: ${bestSpecialist.userName}`);
    return bestSpecialist;
  }

  // ✅ PRIORIDAD 2: Mejor Especialista de Vacaciones
  if (vacationSpecialists.length > 0) {
    const sortedVacationSpecialists = vacationSpecialists.sort((a, b) => {
      if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
      return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
    });

    const bestVacationSpecialist = sortedVacationSpecialists[0];
    
    if (bestVacationSpecialist.workingDaysUntilAvailable > 10) {
      console.log(`🏖️ Especialista ${bestVacationSpecialist.userName} estará disponible en ${bestVacationSpecialist.workingDaysUntilAvailable} días (>10)`);
      
      const availableGeneralists = generalists.filter(g => !g.hasVacationConflict);
      if (availableGeneralists.length > 0) {
        const bestGeneralist = availableGeneralists.sort((a, b) => {
          if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
          return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
        })[0];

        const daysBenefit = bestVacationSpecialist.workingDaysUntilAvailable - bestGeneralist.workingDaysUntilAvailable;
        
        if (daysBenefit >= 5) {
          console.log(`✅ Generalista ${bestGeneralist.userName} puede empezar ${daysBenefit} días antes (evitando espera larga)`);
          return bestGeneralist;
        }
      }
    } else {
      console.log(`⏳ Especialista ${bestVacationSpecialist.userName} estará disponible en ${bestVacationSpecialist.workingDaysUntilAvailable} días (≤10), esperando`);
    }
    
    console.log(`✅ Asignando a especialista de vacaciones: ${bestVacationSpecialist.userName}`);
    return bestVacationSpecialist;
  }

  // ✅ PRIORIDAD 3: Mejor Generalista
  if (generalists.length > 0) {
    const availableGeneralists = generalists.filter(g => !g.hasVacationConflict);
    
    if (availableGeneralists.length > 0) {
      const bestGeneralist = availableGeneralists.sort((a, b) => {
        if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
        return a.workingDaysUntilAvailable - b.workingDaysUntilAvailable;
      })[0];
      
      console.log(`✅ Asignando a mejor generalista: ${bestGeneralist.userName}`);
      return bestGeneralist;
    }
  }

  console.log('❌ No se encontró usuario adecuado');
  return null;
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
    if (bestGeneralist) {
      console.log(`Asignación: No hay especialistas. Elegido el mejor generalista: ${bestGeneralist.userName} (Carga: ${bestGeneralist.cargaTotal}).`);
    } else {
      console.log(`Asignación: No hay usuarios disponibles.`);
    }
    return bestGeneralist;
  }
  if (!bestGeneralist) {
    console.log(`Asignación: No hay generalistas. Elegido el mejor especialista: ${bestSpecialist.userName} (Carga: ${bestSpecialist.cargaTotal}).`);
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
    console.log(`Asignación: Generalista ${bestGeneralist.userName} FORZADO sobre especialista ${bestSpecialist.userName}. Deadline del especialista (${effectiveSpecialistDeadline.toISOString()}) es más de ${TASK_ASSIGNMENT_THRESHOLDS.DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST} días más lejano que el del generalista (${effectiveGeneralistDeadline.toISOString()}). Diferencia: ${deadlineDifferenceDays.toFixed(1)} días.`);
    return bestGeneralist;
  }

  console.log(`Asignación: Especialista ${bestSpecialist.userName} mantenido, ya que su deadline no es excesivamente lejano en comparación con el generalista.`);
  return bestSpecialist;
}

/**
 * ✅ FUNCIÓN PRINCIPAL CON CACHE: Incluye lógica de vacaciones cuando se proporciona duración
 */
export async function getBestUserWithCache(
  typeId: number, 
  brandId: string, 
  priority: Priority,
  durationDays?: number
): Promise<UserSlot | null> {
  
  if (durationDays) {
    // ✅ CON DURACIÓN: Usar lógica de vacaciones + cache
    const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}-vacation-${durationDays}`;
    let bestSlot = getFromCache<UserSlot | null>(cacheKey);

    if (bestSlot !== undefined) {
      console.log(`Cache hit for best user selection with vacation logic: ${cacheKey}`);
      return bestSlot;
    }
    console.log(`Cache miss for best user selection with vacation logic: ${cacheKey}, calculating...`);

    const vacationAwareSlots = await getVacationAwareUserSlots(typeId, brandId, durationDays);
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
  
  // ✅ SIN DURACIÓN: Usar lógica original + cache
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) {
    console.log(`Cache hit for best user selection (legacy): ${cacheKey}`);
    return bestSlot;
  }
  console.log(`Cache miss for best user selection (legacy): ${cacheKey}, calculating...`);

  const compatibleUsers = await findCompatibleUsers(typeId, brandId);
  if (compatibleUsers.length === 0) {
    setInCache(cacheKey, null);
    return null;
  }

  const userSlots = await calculateUserSlots(compatibleUsers, typeId, brandId);
  bestSlot = selectBestUser(userSlots);

  setInCache(cacheKey, bestSlot);
  return bestSlot;
}

// ✅ FUNCIONES DE CÁLCULO DE POSICIÓN EN COLA

/**
 * Verifica si una tarea LOW está en su "período de espera"
 */
function isLowTaskInWaitingPeriod(task: Task): boolean {
  const now = new Date();
  const taskCreationTime = new Date(task.createdAt);
  
  const workingHoursElapsed = calculateWorkingHoursBetween(taskCreationTime, now);
  
  console.log(`🕐 Tarea LOW "${task.name}": creada ${taskCreationTime.toISOString()}, han pasado ${workingHoursElapsed.toFixed(1)} horas laborales`);
  
  return workingHoursElapsed < 8;
}

/**
 * Calcula las horas laborales transcurridas entre dos fechas
 */
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

export async function calculateQueuePosition(userSlot: UserSlot, priority: Priority): Promise<QueueCalculationResult> {
  let insertAt = 0
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  console.log(`🎯 Calculando posición para usuario ${userSlot.userName}`)
  console.log(`📅 Usuario disponible desde: ${userSlot.availableDate.toISOString()}`)

  switch (priority) {
    case 'URGENT':
      insertAt = 0
      calculatedStartDate = await getNextAvailableStart(new Date())
      affectedTasks.push(...userSlot.tasks)
      break

    case 'HIGH':
      if (userSlot.tasks.length >= 1) {
        const firstTask = userSlot.tasks[0]
        const firstTaskTier = firstTask.category?.tier

        if (firstTaskTier && ['E', 'D'].includes(firstTaskTier)) {
          insertAt = 1
          calculatedStartDate = await getNextAvailableStart(new Date(firstTask.deadline))
          affectedTasks.push(...userSlot.tasks.slice(1))
        } else if (firstTaskTier && ['C', 'B', 'A', 'S'].includes(firstTaskTier)) {
          insertAt = 0
          calculatedStartDate = await getNextAvailableStart(new Date())
          affectedTasks.push(...userSlot.tasks)
        } else {
          console.warn(`⚠️ Tier inesperado para la primera tarea de prioridad HIGH: ${firstTaskTier}. Se asumirá tier alto y se insertará al inicio.`)
          insertAt = 0
          calculatedStartDate = await getNextAvailableStart(new Date())
          affectedTasks.push(...userSlot.tasks)
        }
      } else {
        insertAt = 0
        calculatedStartDate = await getNextAvailableStart(new Date())
      }
      break

    case 'NORMAL':
      return await calculateNormalPriorityPosition(userSlot)

    case 'LOW':
      return await calculateLowPriorityPosition(userSlot)

    default:
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate
  }

  console.log(`✅ Resultado: insertAt=${insertAt}, fecha=${calculatedStartDate.toISOString()}`)
  console.log(`📋 Tareas afectadas identificadas para ${userSlot.userName}: ${affectedTasks.length} tareas. IDs: ${affectedTasks.map(t => t.id).join(', ')}`);

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

async function calculateNormalPriorityPosition(userSlot: UserSlot): Promise<QueueCalculationResult> {
  let insertAt = userSlot.tasks.length
  let calculatedStartDate: Date
  const affectedTasks: Task[] = []

  for (let i = 0; i < userSlot.tasks.length; i++) {
    const currentTask = userSlot.tasks[i]

    if (currentTask.priority === 'LOW') {
      if (isLowTaskInWaitingPeriod(currentTask)) {
        console.log(`🔒 Tarea LOW "${currentTask.name}" en período de espera, NORMAL debe ir antes`)
        let normalTasksBeforeThisLow = 0
        for (let j = 0; j < i; j++) {
          if (userSlot.tasks[j].priority === 'NORMAL') {
            normalTasksBeforeThisLow++
          }
        }

        if (normalTasksBeforeThisLow < TASK_ASSIGNMENT_THRESHOLDS.NORMAL_TASKS_BEFORE_LOW_THRESHOLD) {
          insertAt = i
          affectedTasks.push(...userSlot.tasks.slice(i))
          break
        }
        insertAt = i + 1
      } else {
        console.log(`⏰ Tarea LOW "${currentTask.name}" fuera del período de espera, NORMAL puede ir después`)
        insertAt = i + 1
      }
    } else if (currentTask.priority === 'NORMAL') {
      insertAt = i + 1
    }
  }

  if (insertAt === 0) {
    calculatedStartDate = userSlot.availableDate
  } else {
    const prevTask = userSlot.tasks[insertAt - 1]
    calculatedStartDate = await getNextAvailableStart(new Date(prevTask.deadline))
  }

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
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
    console.log(`🔒 Insertando nueva tarea LOW después de tareas LOW en período de espera (posición ${insertAt})`)
  } else {
    let consecutiveLowCount = 0
    for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
      if (userSlot.tasks[i].priority === 'LOW') {
        consecutiveLowCount++
      } else {
        break
      }
    }

    console.log(`📊 LOW: ${consecutiveLowCount} tareas LOW consecutivas al final`)

    if (consecutiveLowCount < TASK_ASSIGNMENT_THRESHOLDS.CONSECUTIVE_LOW_TASKS_THRESHOLD) {
      console.log(`✅ LOW: Insertando al final en posición ${userSlot.tasks.length}`)
      insertAt = userSlot.tasks.length
    } else {
      insertAt = userSlot.tasks.length - consecutiveLowCount
      console.log(`⚠️ LOW: Límite alcanzado, insertando en posición ${insertAt}`)
    }
  }

  calculatedStartDate = userSlot.availableDate

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  }
}

export async function updateAffectedTasksPositions(
  userId: string,
  insertAt: number,
  affectedTasks: Task[]
): Promise<void> {
  await shiftUserTasks(userId, 'NEW_TASK_PLACEHOLDER', new Date(), insertAt);
  console.log(`✅ Actualizadas ${affectedTasks.length} posiciones de tareas para usuario ${userId} (vía updateAffectedTasksPositions -> shiftUserTasks)`);
}

export async function processUserAssignments(
  usersToAssign: string[],
  userSlots: UserSlot[],
  priority: Priority,
  durationDays: number
): Promise<TaskTimingResult> {
  const numberOfAssignees = usersToAssign.length
  const effectiveDuration = durationDays / numberOfAssignees
  const newTaskHours = effectiveDuration * 8

  let earliestStartDate = new Date()
  let latestDeadline = new Date()
  let primaryInsertAt = 0

  console.log(`🚀 Procesando asignación para ${usersToAssign.length} usuarios`)

  for (const userId of usersToAssign) {
    const userSlot = userSlots.find(slot => slot.userId === userId)

    if (!userSlot) {
      console.warn(`⚠️ Usuario ${userId} no encontrado en slots calculados`)
      continue
    }

    const queueResult = await calculateQueuePosition(userSlot, priority)

    const userStartDate = queueResult.calculatedStartDate
    const userDeadline = await calculateWorkingDeadline(userStartDate, newTaskHours)

    if (queueResult.affectedTasks.length > 0) {
      console.log(`🔄 Preparando para reacomodar ${queueResult.affectedTasks.length} tareas para el usuario ${userSlot.userName}.`)
      await shiftUserTasks(userSlot.userId, 'temp-new-task-id', userDeadline, queueResult.insertAt);
    }

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

    console.log(`✅ Usuario ${userSlot.userName}: start=${userStartDate.toISOString()}, deadline=${userDeadline.toISOString()}`)
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