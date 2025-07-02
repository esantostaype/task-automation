// utils/task-calculation-utils.ts - VERSIÓN CONSERVADORA

import { prisma } from '@/utils/prisma';
import { Status } from '@prisma/client';

// ✅ HORARIOS PARA PERÚ (UTC-5) = 15:00-24:00 UTC
const WORK_START_HOUR = 15;    // 10:00 AM Perú = 15:00 UTC
const WORK_LUNCH_START = 19;   // 2:00 PM Perú = 19:00 UTC  
const WORK_LUNCH_END = 20;     // 3:00 PM Perú = 20:00 UTC
const WORK_END_HOUR = 24;      // 7:00 PM Perú = 24:00 UTC (medianoche)

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
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    // Ajustar a horario laboral si está fuera de él
    if (hour < WORK_START_HOUR) {
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0);
    } else if (hour >= WORK_LUNCH_START && hour < WORK_LUNCH_END) {
      result.setUTCHours(WORK_LUNCH_END, 0, 0, 0);
    } else if (hour >= WORK_END_HOUR) {
      result.setUTCDate(result.getUTCDate() + 1);
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0);
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
    { from: WORK_START_HOUR, to: WORK_LUNCH_START },
    { from: WORK_LUNCH_END, to: WORK_END_HOUR },
  ];

  while (remaining > 0) {
    const day = current.getUTCDay();

    if (day === 0 || day === 6) {
      const daysToAdd = day === 0 ? 1 : 2;
      current.setUTCDate(current.getUTCDate() + daysToAdd);
      current.setUTCHours(WORK_START_HOUR, 0, 0, 0);
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
        current.setUTCHours(WORK_START_HOUR, 0, 0, 0);
    }
  }

  return current;
}

/**
 * ✅ CONSERVADOR: Reorganiza tareas sin transacciones complejas
 */
export async function shiftUserTasks(userId: string, newTaskId: string, newDeadline: Date, startPosition: number) {
  console.log(`🔀 Iniciando reordenamiento de cola para el usuario ${userId} desde la posición ${startPosition}.`);

  // 1. Obtener tareas que necesitan ser desplazadas
  const tasksToShift = await prisma.task.findMany({
    where: {
      id: { not: newTaskId },
      status: { in: [Status.TO_DO, Status.IN_PROGRESS, Status.ON_APPROVAL] },
      assignees: {
        some: { userId: userId }
      }
    },
    orderBy: { queuePosition: 'asc' },
    include: { category: true }
  });

  const filteredTasksToShift = tasksToShift.filter(t => t.queuePosition >= startPosition);
  
  if(filteredTasksToShift.length === 0) {
    console.log("💨 No hay tareas para desplazar. Fin del reordenamiento.");
    return;
  }

  // 2. La primera tarea desplazada comenzará después de la nueva tarea
  let lastDeadline = await getNextAvailableStart(newDeadline);

  // 3. Actualizar cada tarea con nuevas fechas
  for (let i = 0; i < filteredTasksToShift.length; i++) {
    const task = filteredTasksToShift[i];
    const newPosition = startPosition + i + 1;

    console.log(`  -> Desplazando tarea "${task.name}" (ID: ${task.id}) a la posición ${newPosition}.`);

    const taskHours = task.category.duration * 8;
    const newStartDate = await getNextAvailableStart(lastDeadline);
    const newDeadlineForTask = await calculateWorkingDeadline(newStartDate, taskHours);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        startDate: newStartDate,
        deadline: newDeadlineForTask,
        queuePosition: newPosition,
      },
    });

    lastDeadline = newDeadlineForTask;
  }

  console.log(`✅ Reordenamiento de cola para el usuario ${userId} completado.`);
}

/**
 * ✅ CONSERVADOR: Obtener horas de tarea (sin cambios)
 */
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