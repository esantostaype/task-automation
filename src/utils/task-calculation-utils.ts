// lib/task-calculation-utils.ts
import { prisma } from '@/utils/prisma'; // Asegúrate de que prisma se importa correctamente
import { Status } from '@prisma/client';

// ✅ HORARIOS CORREGIDOS PARA PERÚ (UTC-5) = 15:00-24:00 UTC
const WORK_START_HOUR = 15;    // 10:00 AM Perú = 15:00 UTC
const WORK_LUNCH_START = 19;   // 2:00 PM Perú = 19:00 UTC  
const WORK_LUNCH_END = 20;     // 3:00 PM Perú = 20:00 UTC
const WORK_END_HOUR = 24;      // 7:00 PM Perú = 24:00 UTC (medianoche)
// Bloques: 15:00-19:00 (4h) + 20:00-24:00 (4h) = 8 horas laborales/día

/**
 * Reorganiza y recalcula las tareas de un usuario en la cola después de insertar una nueva tarea.
 * Esta función es clave para mantener la integridad de las fechas y posiciones.
 * @param userId ID del usuario (String) al que se le asignó la tarea.
 * @param newTaskId ID de la tarea recién creada.
 * @param newDeadline Deadline de la tarea recién creada.
 * @param startPosition Posición en la que se insertó la nueva tarea.
 */
export async function shiftUserTasks(userId: string, newTaskId: string, newDeadline: Date, startPosition: number) {
  console.log(`🔀 Iniciando reordenamiento de cola para el usuario ${userId} desde la posición ${startPosition}.`);

  // 1. Obtener todas las tareas del usuario que necesitan ser desplazadas.
  //    Estas son las tareas cuya posición es igual o mayor a la de la nueva tarea,
  //    excluyendo a la nueva tarea en sí misma.
  const tasksToShift = await prisma.task.findMany({
    where: {
      id: { not: newTaskId },
      status: { in: [Status.TO_DO, Status.IN_PROGRESS, Status.ON_APPROVAL] }, // Solo desplazar tareas activas
      assignees: {
        some: { userId: userId }
      }
    },
    orderBy: { queuePosition: 'asc' },
    include: { category: true }
  });

  // Filtramos en memoria las tareas que realmente deben moverse, ya que la query inicial
  // puede traer tareas de diferentes colas (brands/types) si no se especifica.
  // Nos quedamos solo con las que están en la misma posición o después.
  const filteredTasksToShift = tasksToShift.filter(t => t.queuePosition >= startPosition);
  
  if(filteredTasksToShift.length === 0) {
    console.log("💨 No hay tareas para desplazar. Fin del reordenamiento.");
    return;
  }

  // 2. La primera tarea desplazada comenzará justo después de que la nueva tarea termine.
  let lastDeadline = await getNextAvailableStart(newDeadline);

  // 3. Iterar sobre cada tarea a desplazar para actualizar su posición y fechas.
  for (let i = 0; i < filteredTasksToShift.length; i++) {
    const task = filteredTasksToShift[i];
    const newPosition = startPosition + i + 1;

    console.log(`  -> Desplazando tarea "${task.name}" (ID: ${task.id}) a la posición ${newPosition}.`);

    // Calcular las nuevas fechas para esta tarea
    const taskHours = task.category.duration * 8; // La duración viene de la categoría
    const newStartDate = await getNextAvailableStart(lastDeadline);
    const newDeadlineForTask = await calculateWorkingDeadline(newStartDate, taskHours);

    // Actualizar la tarea en la base de datos
    await prisma.task.update({
      where: { id: task.id },
      data: {
        startDate: newStartDate,
        deadline: newDeadlineForTask,
        queuePosition: newPosition,
      },
    });

    // La siguiente tarea comenzará después de que esta termine
    lastDeadline = newDeadlineForTask;
  }
    console.log(`✅ Reordenamiento de cola para el usuario ${userId} completado.`);
}


/**
 * Obtiene las horas ajustadas de una tarea específica.
 * @param taskId ID de la tarea (String).
 * @returns Número de horas de la tarea.
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

/**
 * Redondea una fecha a la siguiente media hora (0 o 30 minutos).
 * @param date Fecha a redondear.
 * @returns Nueva fecha redondeada.
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
 * Calcula la próxima fecha y hora de inicio disponible, respetando fines de semana y horarios laborales.
 * @param date Fecha inicial para el cálculo.
 * @returns Fecha de inicio disponible.
 */
export async function getNextAvailableStart(date: Date): Promise<Date> {
  const result = new Date(date);

  while (true) {
    const day = result.getUTCDay(); // Día de la semana (0-6, Domingo-Sábado)
    const hour = result.getUTCHours(); // Hora UTC

    // Saltar fines de semana
    if (day === 0 || day === 6) {
      const daysToAdd = day === 0 ? 1 : 2; // Si es domingo, añadir 1 para el lunes; si es sábado, añadir 2 para el lunes
      result.setUTCDate(result.getUTCDate() + daysToAdd); // Avanzar los días
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0); // Establecer la hora al inicio del día laboral
      continue; // Volver a verificar
    }

    // Ajustar a horario laboral si está fuera de él
    if (hour < WORK_START_HOUR) {
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0);
    } else if (hour >= WORK_LUNCH_START && hour < WORK_LUNCH_END) {
      result.setUTCHours(WORK_LUNCH_END, 0, 0, 0); // Saltar hora de almuerzo
    } else if (hour >= WORK_END_HOUR) {
      result.setUTCDate(result.getUTCDate() + 1); // Avanzar al siguiente día
      result.setUTCHours(WORK_START_HOUR, 0, 0, 0); // Establecer la hora al inicio del día laboral
      continue; // Volver a verificar
    }

    // Redondear la hora de inicio a la siguiente media hora más cercana
    return roundUpToNextHalfHour(result);
  }
}

/**
 * Calcula la fecha y hora límite (deadline) de una tarea sumando las horas laborales necesarias.
 * @param start Fecha de inicio de la tarea.
 * @param hoursNeeded Horas laborales necesarias para completar la tarea.
 * @returns Fecha límite calculada.
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