// services/task-assignment.service.ts
import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import {UserSlot,UserWithRoles,Task,QueueCalculationResult,TaskTimingResult } from '@/interfaces';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';

const GENERALIST_CONSIDERATION_THRESHOLD = 3;

/**
 * Encuentra usuarios compatibles para un tipo de tarea específico
 */
export async function findCompatibleUsers(typeId: number, brandId: string): Promise<UserWithRoles[]> {
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

  return allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  ) as UserWithRoles[];
}

/**
 * Calcula slots de usuarios con información de carga y disponibilidad
 */
export async function calculateUserSlots(
  users: UserWithRoles[],
  typeId: number,
  brandId: string
): Promise<UserSlot[]> {
  return Promise.all(users.map(async (user) => {
    const tasks = await prisma.task.findMany({
      where: {
        typeId: typeId,
        brandId: brandId,
        assignees: {
          some: { userId: user.id }
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

    const cargaTotal = tasks.length;

    let availableDate: Date;
    if (tasks.length > 0) {
      availableDate = new Date(tasks[tasks.length - 1].deadline);
    } else {
      availableDate = await getNextAvailableStart(new Date());
    }

    const matchingRoles = user.roles.filter(role => role.typeId === typeId);
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

    return {
      userId: user.id,
      userName: user.name,
      availableDate,
      tasks,
      cargaTotal,
      isSpecialist,
    };
  }));
}

/**
 * Selecciona el mejor usuario para asignación automática
 */
export function selectBestUser(userSlots: UserSlot[]): UserSlot | null {
  // Separar especialistas y generalistas
  const specialists = userSlots.filter(slot => slot.isSpecialist);
  const generalists = userSlots.filter(slot => !slot.isSpecialist);

  // Función de ordenamiento común
  const sortUsers = (users: UserSlot[]) => {
    return users.sort((a, b) => {
      if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal;
      return a.availableDate.getTime() - b.availableDate.getTime();
    });
  };

  let bestSlot: UserSlot | null = null;

  // Priorizar especialistas
  if (specialists.length > 0) {
    const sortedSpecialists = sortUsers(specialists);
    bestSlot = sortedSpecialists[0];
    console.log(`Asignación: Especialista preferido encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`);
  }

  // Considerar generalistas si el especialista tiene mucha carga
  if (!bestSlot || bestSlot.cargaTotal >= GENERALIST_CONSIDERATION_THRESHOLD) {
    if (generalists.length > 0) {
      const sortedGeneralists = sortUsers(generalists);
      const bestGeneralist = sortedGeneralists[0];

      if (bestSlot) {
        // Comparar generalista vs especialista
        const shouldUseGeneralist = bestGeneralist.cargaTotal < bestSlot.cargaTotal ||
          bestGeneralist.availableDate.getTime() < bestSlot.availableDate.getTime() - (2 * 24 * 60 * 60 * 1000);

        if (shouldUseGeneralist) {
          bestSlot = bestGeneralist;
          console.log(`Asignación: Generalista ${bestSlot.userName} elegido sobre especialista por menor carga/disponibilidad.`);
        } else {
          console.log(`Asignación: Especialista ${bestSlot.userName} mantenido, generalista no es significativamente mejor.`);
        }
      } else {
        bestSlot = bestGeneralist;
        console.log(`Asignación: No hay especialistas, mejor generalista encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`);
      }
    }
  }

  return bestSlot;
}

/**
 * Calcula la posición en la cola y fecha de inicio basada en la prioridad
 */
export function calculateQueuePosition(userSlot: UserSlot, priority: Priority): QueueCalculationResult {
  let insertAt = 0;
  let calculatedStartDate: Date;
  const affectedTasks: Task[] = [];

  switch (priority) {
    case 'URGENT':
      insertAt = 0;
      calculatedStartDate = new Date(); // Inmediatamente
      // Todas las tareas existentes se ven afectadas
      affectedTasks.push(...userSlot.tasks);
      break;

    case 'HIGH':
      if (userSlot.tasks.length >= 1) {
        const firstTask = userSlot.tasks[0];
        const firstTaskTier = firstTask.category?.tier;

        if (firstTaskTier && ['E', 'D'].includes(firstTaskTier)) {
          // Insertar después de la primera tarea de tier alto
          insertAt = 1;
          calculatedStartDate = new Date(firstTask.deadline);
          affectedTasks.push(...userSlot.tasks.slice(1));
        } else if (firstTaskTier && ['C', 'B', 'A', 'S'].includes(firstTaskTier)) {
          // Insertar al principio
          insertAt = 0;
          calculatedStartDate = new Date();
          affectedTasks.push(...userSlot.tasks);
        } else {
          // Tratar como NORMAL si no hay tier definido
          return calculateNormalPriorityPosition(userSlot);
        }
      } else {
        insertAt = 0;
        calculatedStartDate = new Date();
      }
      break;

    case 'NORMAL':
      return calculateNormalPriorityPosition(userSlot);

    case 'LOW':
      insertAt = userSlot.tasks.length;
      calculatedStartDate = userSlot.availableDate;
      // No se afectan tareas existentes
      break;

    default:
      insertAt = userSlot.tasks.length;
      calculatedStartDate = userSlot.availableDate;
  }

  return {
    insertAt,
    calculatedStartDate: calculatedStartDate,
    affectedTasks
  };
}

/**
 * Calcula posición para tareas con prioridad NORMAL
 */
function calculateNormalPriorityPosition(userSlot: UserSlot): QueueCalculationResult {
  let insertAt = userSlot.tasks.length;
  let calculatedStartDate: Date;
  const affectedTasks: Task[] = [];

  // Buscar posición óptima para tareas NORMAL
  for (let i = 0; i < userSlot.tasks.length; i++) {
    const currentTask = userSlot.tasks[i];

    if (currentTask.priority === 'LOW') {
      // Contar tareas NORMAL antes de esta LOW
      let normalTasksBeforeThisLow = 0;
      for (let j = 0; j < i; j++) {
        if (userSlot.tasks[j].priority === 'NORMAL') {
          normalTasksBeforeThisLow++;
        }
      }

      if (normalTasksBeforeThisLow < 5) {
        insertAt = i;
        affectedTasks.push(...userSlot.tasks.slice(i));
        break;
      }
      insertAt = i + 1;
    } else if (currentTask.priority === 'NORMAL') {
      insertAt = i + 1;
    }
  }

  // Calcular fecha de inicio
  if (insertAt === 0) {
    calculatedStartDate = new Date();
  } else {
    const prevTask = userSlot.tasks[insertAt - 1];
    calculatedStartDate = new Date(prevTask.deadline);
  }

  return {
    insertAt,
    calculatedStartDate,
    affectedTasks
  };
}

/**
 * Actualiza las posiciones de las tareas afectadas por la inserción
 */
export async function updateAffectedTasksPositions(
  userId: string,
  insertAt: number,
  affectedTasks: Task[]
): Promise<void> {
  // Actualizar posiciones de las tareas que se mueven hacia abajo
  for (let i = 0; i < affectedTasks.length; i++) {
    const task = affectedTasks[i];
    const newPosition = insertAt + i + 1; // +1 porque la nueva tarea ocupa insertAt

    await prisma.task.update({
      where: { id: task.id },
      data: { queuePosition: newPosition }
    });
  }

  console.log(`✅ Actualizadas ${affectedTasks.length} posiciones de tareas para usuario ${userId}`);
}

/**
 * Procesa la asignación de usuarios y calcula posiciones para cada uno
 */
export async function processUserAssignments(
  usersToAssign: string[],
  userSlots: UserSlot[],
  priority: Priority,
  durationDays: number
): Promise<TaskTimingResult> {
  const numberOfAssignees = usersToAssign.length;
  const effectiveDuration = durationDays / numberOfAssignees;
  const newTaskHours = effectiveDuration * 8;

  let earliestStartDate = new Date();
  let latestDeadline = new Date();
  let primaryInsertAt = 0;

  // Procesar cada usuario asignado
  for (const userId of usersToAssign) {
    const userSlot = userSlots.find(slot => slot.userId === userId);

    if (!userSlot) {
      console.warn(`⚠️ Usuario ${userId} no encontrado en slots calculados`);
      continue;
    }

    // Calcular posición y fechas para este usuario
    const queueResult = calculateQueuePosition(userSlot, priority);

    // Actualizar posiciones de tareas afectadas
    if (queueResult.affectedTasks.length > 0) {
      await updateAffectedTasksPositions(userId, queueResult.insertAt, queueResult.affectedTasks);
    }

    // Calcular fechas para este usuario específico
    const userStartDate = await getNextAvailableStart(queueResult.calculatedStartDate);
    const userDeadline = await calculateWorkingDeadline(userStartDate, newTaskHours);

    // Usar las fechas del primer usuario como referencia principal
    if (userId === usersToAssign[0]) {
      earliestStartDate = userStartDate;
      latestDeadline = userDeadline;
      primaryInsertAt = queueResult.insertAt;
    } else {
      // Ajustar fechas si es necesario (tomar la más temprana para inicio, más tardía para deadline)
      if (userStartDate < earliestStartDate) {
        earliestStartDate = userStartDate;
      }
      if (userDeadline > latestDeadline) {
        latestDeadline = userDeadline;
      }
    }

    console.log(`✅ Usuario ${userSlot.userName}: insertAt=${queueResult.insertAt}, start=${userStartDate.toISOString()}, deadline=${userDeadline.toISOString()}`);
  }

  return {
    startDate: earliestStartDate,
    deadline: latestDeadline,
    insertAt: primaryInsertAt
  };
}