// src/services/task-assignment.service.ts - VERSIÓN CONSERVADORA

import { prisma } from '@/utils/prisma';
import { Priority, Status } from '@prisma/client';
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline, shiftUserTasks } from '@/utils/task-calculation-utils';
import { TASK_ASSIGNMENT_THRESHOLDS, CACHE_KEYS } from '@/config'; // Importar umbrales y claves de caché
import { getFromCache, setInCache } from '@/utils/cache'; // Importar funciones de caché

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
  // Genera una clave de caché que incluya los IDs de usuario para garantizar unicidad
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
 * Función centralizada y cacheada para obtener el mejor usuario.
 * Utiliza findCompatibleUsers, calculateUserSlots y selectBestUser internamente.
 */
export async function getBestUserWithCache(typeId: number, brandId: string, priority: Priority): Promise<UserSlot | null> {
  const cacheKey = `${CACHE_KEYS.BEST_USER_SELECTION_PREFIX}${typeId}-${brandId}-${priority}`;
  let bestSlot = getFromCache<UserSlot | null>(cacheKey);

  if (bestSlot !== undefined) { // Usar !== undefined para manejar 'null' como un valor cacheado válido
    console.log(`Cache hit for best user selection: ${cacheKey}`);
    return bestSlot;
  }
  console.log(`Cache miss for best user selection: ${cacheKey}, calculating...`);

  const compatibleUsers = await findCompatibleUsers(typeId, brandId);
  if (compatibleUsers.length === 0) {
    setInCache(cacheKey, null); // Cachear null si no hay usuarios compatibles
    return null;
  }

  const userSlots = await calculateUserSlots(compatibleUsers, typeId, brandId);
  bestSlot = selectBestUser(userSlots);

  setInCache(cacheKey, bestSlot);
  return bestSlot;
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
      let consecutiveLowCount = 0;
      for (let i = userSlot.tasks.length - 1; i >= 0; i--) {
        if (userSlot.tasks[i].priority === 'LOW') {
          consecutiveLowCount++;
        } else {
          break;
        }
      }

      console.log(`  -> LOW: ${consecutiveLowCount} tareas LOW consecutivas al final`);

      if (consecutiveLowCount < TASK_ASSIGNMENT_THRESHOLDS.CONSECUTIVE_LOW_TASKS_THRESHOLD) {
        console.log(`  -> LOW: Insertando al final en posición ${userSlot.tasks.length}`);
        insertAt = userSlot.tasks.length;
      } else {
        insertAt = userSlot.tasks.length - consecutiveLowCount;
        console.log(`  -> LOW: Límite alcanzado, insertando en posición ${insertAt}`);
      }
      calculatedStartDate = userSlot.availableDate;
      break

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