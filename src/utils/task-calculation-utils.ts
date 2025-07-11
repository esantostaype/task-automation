/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Task } from '@/interfaces';
import { emitTaskUpdateEvent, updateTaskInClickUp } from '@/services/clickup.service';
import { prisma } from '@/utils/prisma';
import { Status } from '@prisma/client';
import { WORK_HOURS } from '@/config';

/**
 * ✅ CONSERVADOR: Redondea una fecha a la siguiente media hora
 */
export function roundUpToNextHalfHour(date: Date): Date {
  const result = new Date(date);
  const minutes = result.getMinutes();

  if (minutes === 0 || minutes === 30) return result;

  if (minutes < 30) {
    result.setMinutes(30, 0, 0);
  } else {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  }

  return result;
}

/**
 * ✅ CONSERVADOR: Calcula la próxima fecha y hora de inicio disponible
 */
export async function getNextAvailableStart(date: Date): Promise<Date> {
  const result = new Date(date);

  while (true) {
    const day = result.getUTCDay(); // Día de la semana (0-6, Domingo-Sábado)
    const hour = result.getUTCHours(); // Hora UTC

    // Saltar fines de semana
    if (day === 0 || day === 6) {
      const daysToAdd = day === 0 ? 1 : 2;
      result.setUTCDate(result.getUTCDate() + daysToAdd);
      result.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }

    // Ajustar a horario laboral si está fuera de él
    if (hour < WORK_HOURS.START) {
      result.setUTCHours(WORK_HOURS.START, 0, 0, 0);
    } else if (hour >= WORK_HOURS.LUNCH_START && hour < WORK_HOURS.LUNCH_END) {
      result.setUTCHours(WORK_HOURS.LUNCH_END, 0, 0, 0);
    } else if (hour >= WORK_HOURS.END) {
      result.setUTCDate(result.getUTCDate() + 1);
      result.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }

    return roundUpToNextHalfHour(result);
  }
}

/**
 * ✅ CONSERVADOR: Calcula la fecha límite considerando horas laborales
 */
export async function calculateWorkingDeadline(start: Date, hoursNeeded: number): Promise<Date> {
  let remaining = hoursNeeded;
  let current = new Date(start);

  const workBlocks = [
    { from: WORK_HOURS.START, to: WORK_HOURS.LUNCH_START },
    { from: WORK_HOURS.LUNCH_END, to: WORK_HOURS.END },
  ];

  while (remaining > 0) {
    const day = current.getUTCDay();

    if (day === 0 || day === 6) {
      const daysToAdd = day === 0 ? 1 : 2;
      current.setUTCDate(current.getUTCDate() + daysToAdd);
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
      continue;
    }

    let timeUsedToday = 0;
    let processedAnyBlock = false;

    const originalCurrentDay = current.getUTCDate();

    for (const block of workBlocks) {
      const blockStart = new Date(current);
      blockStart.setUTCHours(block.from, 0, 0, 0);

      const blockEnd = new Date(current);
      blockEnd.setUTCHours(block.to, 0, 0, 0);

      if (current < blockStart) {
        current = new Date(blockStart);
      }

      if (current >= blockEnd) {
        continue;
      }

      processedAnyBlock = true;

      const availableInBlock = (blockEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
      const timeToUse = Math.min(availableInBlock, remaining);

      current = new Date(current.getTime() + timeToUse * 60 * 60 * 1000);
      remaining -= timeToUse;
      timeUsedToday += timeToUse;

      if (remaining <= 0) break;
    }

    if (remaining <= 0) {
      break;
    }

    const crossedIntoNextDay = current.getUTCDate() !== originalCurrentDay;

    if (remaining > 0 && (crossedIntoNextDay || !processedAnyBlock || timeUsedToday === 0)) {
      if (!crossedIntoNextDay) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
      current.setUTCHours(WORK_HOURS.START, 0, 0, 0);
    }
  }

  return current;
}

/**
 * ✅ SIMPLIFICADO: Reorganiza tareas solo por fechas, SIN queuePosition
 */
export async function shiftUserTasks(userId: string, newTaskId: string, newDeadline: Date, startPosition?: number) {
  console.log(`🔀 Reorganizando tareas por fechas para usuario ${userId} después de: ${newDeadline.toISOString()}`);
  console.log(`   - Nueva tarea ID (para exclusión): ${newTaskId}`);

  // ✅ OBTENER TAREAS ORDENADAS POR FECHA, NO POR queuePosition
  const tasksToShift = await prisma.task.findMany({
    where: {
      id: { not: newTaskId },
      status: { in: [Status.TO_DO, Status.IN_PROGRESS, Status.ON_APPROVAL] },
      assignees: {
        some: { userId: userId }
      },
      // ✅ Solo mover tareas que empiecen después del deadline de la nueva tarea
      startDate: { 
        gte: newDeadline 
      }
    },
    orderBy: { startDate: 'asc' }, // ✅ ORDENAR POR FECHA, NO POR queuePosition
    include: { 
      category: {
        include: {
          tierList: true
        }
      }
    }
  });

  console.log(`   - Tareas que necesitan ser movidas: ${tasksToShift.length}`);
  
  if (tasksToShift.length === 0) {
    console.log("💨 No hay tareas para reorganizar. Fin del reordenamiento.");
    return;
  }

  // ✅ RECALCULAR FECHAS DE MANERA SECUENCIAL
  let lastDeadline = await getNextAvailableStart(newDeadline);
  console.log(`   - Primera tarea reorganizada empezará desde: ${lastDeadline.toISOString()}`);

  for (let i = 0; i < tasksToShift.length; i++) {
    const task = tasksToShift[i];

    console.log(`  -> Reorganizando tarea "${task.name}" (ID: ${task.id})`);

    const effectiveDurationDays = (task as any).customDuration ?? task.category.tierList.duration;
    const taskHours = effectiveDurationDays * 8;
    const newStartDate = await getNextAvailableStart(lastDeadline);
    const newDeadlineForTask = await calculateWorkingDeadline(newStartDate, taskHours);

    console.log(`     - Anterior: Start=${task.startDate.toISOString()}, Deadline=${task.deadline.toISOString()}`);
    console.log(`     - Nuevo:    Start=${newStartDate.toISOString()}, Deadline=${newDeadlineForTask.toISOString()}`);

    // ✅ ACTUALIZAR SOLO FECHAS, SIN queuePosition
    const updatedPrismaTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        startDate: newStartDate,
        deadline: newDeadlineForTask,
        // ✅ NO actualizar queuePosition
      },
      include: {
        category: {
          include: {
            type: true,
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: { include: { user: true } }
      }
    });

    // Emitir evento Socket.IO
    try {
      await emitTaskUpdateEvent(updatedPrismaTask);
      console.log(`✅ Evento task_update emitido para tarea reorganizada: ${updatedPrismaTask.id}`);
    } catch (socketEmitError) {
      console.error(`⚠️ Error al emitir evento de socket para tarea reorganizada ${updatedPrismaTask.id}:`, socketEmitError);
    }

    lastDeadline = newDeadlineForTask;
  }

  console.log(`✅ Reorganización por fechas para usuario ${userId} completada.`);
}

/**
 * ✅ CORREGIDO: Obtener horas de tarea usando la nueva estructura tierList
 */
export async function getTaskHours(taskId: string): Promise<number> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      category: {
        include: {
          tierList: true
        }
      },
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

  return task.customDuration !== null 
    ? task.customDuration * 8 
    : task.category.tierList.duration * 8;
}