/* eslint-disable @typescript-eslint/no-unused-vars */
// src/services/parallel-priority-insertion.service.ts - CORREGIDO
// 🎯 NUEVA LÓGICA: Prioridades en paralelo sin empujar fechas + VACACIONES + SOLO TAREAS FUTURAS

import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils';
import { UserVacation } from '@/interfaces';

interface TaskForParallelInsertion {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
  priority: Priority;
  customDuration?: number | null;
  createdAt: Date;
  category: {
    tierList: {
      duration: number;
    };
  };
}

interface ParallelInsertionResult {
  startDate: Date;
  deadline: Date;
  insertionReason: string;
  parallelWith?: {
    taskId: string;
    taskName: string;
    originalStartDate: Date;
  };
  noTasksAffected: boolean;
  vacationAdjustment?: {
    originalDate: Date;
    adjustedDate: Date;
    conflictingVacations: string[];
  };
  tasksToMove?: { taskId: string; newStartDate: Date; newDeadline: Date }[];
}

/**
 * 🏖️ FUNCIÓN: Obtener próxima fecha disponible después de vacaciones
 */
async function getNextAvailableStartAfterVacations(
  baseDate: Date,
  vacations: UserVacation[],
  taskDurationDays: number = 0
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);

  const sortedVacations = vacations.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let adjusted = true;
  const maxIterations = 10;
  let iterations = 0;

  console.log(`🏖️ Verificando ${sortedVacations.length} vacaciones para fecha base: ${baseDate.toISOString()}`);

  while (adjusted && iterations < maxIterations) {
    adjusted = false;
    iterations++;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = taskDurationDays > 0
      ? await calculateWorkingDeadline(availableDate, taskHours)
      : availableDate;

    console.log(`   🔍 Iteración ${iterations}: Verificando ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      const hasConflict = availableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        console.log(`   ❌ CONFLICTO DETECTADO:`);
        console.log(`      Tarea: ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);
        console.log(`      Vacación: ${vacStart.toISOString()} → ${vacEnd.toISOString()}`);
        
        const dayAfterVacation = new Date(vacEnd);
        dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
        const newAvailableDate = await getNextAvailableStart(dayAfterVacation);

        console.log(`   🔄 Moviendo tarea a: ${newAvailableDate.toISOString()}`);
        
        availableDate = newAvailableDate;
        adjusted = true;
        break;
      }
    }
  }

  console.log(`   ✅ Fecha final después de vacaciones: ${availableDate.toISOString()}`);
  return availableDate;
}

/**
 * 🏖️ FUNCIÓN: Aplicar lógica de vacaciones a resultado de inserción
 */
async function applyVacationLogic(
  userId: string,
  insertionResult: ParallelInsertionResult,
  taskDurationDays: number
): Promise<ParallelInsertionResult> {
  console.log(`🏖️ Aplicando lógica de vacaciones para usuario ${userId}`);
  
  // Obtener vacaciones del usuario
  const userWithVacations = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: {
        where: { endDate: { gte: new Date() } }
      }
    }
  });

  const upcomingVacations: UserVacation[] = userWithVacations?.vacations?.map(v => ({
    id: v.id,
    userId: v.userId,
    startDate: new Date(v.startDate),
    endDate: new Date(v.endDate)
  })) || [];

  console.log(`🏖️ Vacaciones próximas: ${upcomingVacations.length}`);
  upcomingVacations.forEach(vacation => {
    const days = Math.ceil((vacation.endDate.getTime() - vacation.startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   📅 ${vacation.startDate.toISOString().split('T')[0]} → ${vacation.endDate.toISOString().split('T')[0]} (${days} días)`);
  });

  // Si no hay vacaciones, devolver resultado original
  if (upcomingVacations.length === 0) {
    console.log(`✅ Sin vacaciones, usando fechas originales`);
    return insertionResult;
  }

  // Verificar si hay conflictos con vacaciones
  const originalStartDate = insertionResult.startDate;
  const originalDeadline = insertionResult.deadline;
  
  let hasConflict = false;
  const conflictingVacations: string[] = [];

  for (const vacation of upcomingVacations) {
    const vacStart = new Date(vacation.startDate);
    const vacEnd = new Date(vacation.endDate);

    if (originalStartDate <= vacEnd && originalDeadline >= vacStart) {
      hasConflict = true;
      conflictingVacations.push(
        `${vacStart.toISOString().split('T')[0]} → ${vacEnd.toISOString().split('T')[0]}`
      );
    }
  }

  // Si no hay conflictos, devolver resultado original
  if (!hasConflict) {
    console.log(`✅ Sin conflictos de vacaciones, usando fechas originales`);
    return insertionResult;
  }

  // Ajustar fechas por conflictos de vacaciones
  console.log(`🏖️ === AJUSTANDO POR CONFLICTOS DE VACACIONES ===`);
  console.log(`📅 Fecha original: ${originalStartDate.toISOString()}`);
  console.log(`🏖️ Conflictos con: ${conflictingVacations.join(', ')}`);

  const adjustedStartDate = await getNextAvailableStartAfterVacations(
    originalStartDate,
    upcomingVacations,
    taskDurationDays
  );

  const taskHours = taskDurationDays * 8;
  const adjustedDeadline = await calculateWorkingDeadline(adjustedStartDate, taskHours);

  console.log(`📅 Fecha ajustada: ${adjustedStartDate.toISOString()}`);
  console.log(`📅 Deadline ajustado: ${adjustedDeadline.toISOString()}`);

  return {
    ...insertionResult,
    startDate: adjustedStartDate,
    deadline: adjustedDeadline,
    insertionReason: `${insertionResult.insertionReason} (ajustado por vacaciones)`,
    vacationAdjustment: {
      originalDate: originalStartDate,
      adjustedDate: adjustedStartDate,
      conflictingVacations
    }
  };
}

/**
 * 🔴 URGENT: Inserción en paralelo con todas las tareas FUTURAS
 */
async function handleUrgentParallel(
  futureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔴 URGENT: Inserción en paralelo (no empuja tareas) - SOLO TAREAS FUTURAS');
  
  // Siempre empieza lo más pronto posible
  const newStartDate = await getNextAvailableStart(new Date());
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  // ✅ INFORMACIÓN ADICIONAL: Mostrar con qué tarea va en paralelo
  let parallelWith: { taskId: string; taskName: string; originalStartDate: Date } | undefined;
  
  if (futureTasks.length > 0) {
    // Buscar la primera tarea futura (la que debería ser la #1 en cola)
    const firstFutureTask = futureTasks[0];
    parallelWith = {
      taskId: firstFutureTask.id,
      taskName: firstFutureTask.name,
      originalStartDate: firstFutureTask.startDate
    };
    console.log(`   🔗 Va en paralelo con primera tarea futura: "${firstFutureTask.name}"`);
  } else {
    console.log(`   ℹ️ No hay tareas futuras, será la primera tarea`);
  }
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason: 'URGENT: Paralelo inmediato con primera tarea futura, no afecta tareas existentes',
    parallelWith,
    noTasksAffected: true
  };
}

/**
 * 🟡 HIGH: Inserción en paralelo con segunda tarea futura (evitando NORMAL con URGENT)
 */
async function handleHighParallel(
  futureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟡 HIGH: Inserción en paralelo con segunda tarea futura');
  
  if (futureTasks.length === 0) {
    console.log('   ℹ️ No hay tareas futuras, comportándose como URGENT');
    return handleUrgentParallel([], durationDays);
  }
  
  // ✅ FILTRAR SOLO TAREAS FUTURAS POR PRIORIDAD
  const futureNormalTasks = futureTasks.filter(task => task.priority === 'NORMAL');
  const futureHighTasks = futureTasks.filter(task => task.priority === 'HIGH');
  const futureUrgentTasks = futureTasks.filter(task => task.priority === 'URGENT');
  
  console.log(`   📊 Tareas futuras por prioridad:`);
  console.log(`     - NORMAL futuras: ${futureNormalTasks.length}`);
  console.log(`     - HIGH futuras: ${futureHighTasks.length}`);
  console.log(`     - URGENT futuras: ${futureUrgentTasks.length}`);
  
  // ✅ LÓGICA CORREGIDA: Identificar qué NORMAL futuras ya tienen URGENT en paralelo
  const normalWithUrgent = new Set<string>();
  
  // Buscar URGENT que están en paralelo con NORMAL (solo futuras)
  futureUrgentTasks.forEach(urgentTask => {
    futureNormalTasks.forEach(normalTask => {
      // Verificar si tienen fechas de inicio muy similares (en paralelo)
      const timeDifference = Math.abs(
        urgentTask.startDate.getTime() - normalTask.startDate.getTime()
      );
      const isParallel = timeDifference < 24 * 60 * 60 * 1000; // Menos de 1 día de diferencia
      
      if (isParallel) {
        normalWithUrgent.add(normalTask.id);
        console.log(`   🔴 NORMAL futura "${normalTask.name}" ya tiene URGENT "${urgentTask.name}" en paralelo`);
      }
    });
  });
  
  // ✅ BUSCAR SEGUNDA NORMAL LIBRE (sin URGENT en paralelo) ENTRE LAS FUTURAS
  let targetNormalIndex = -1;
  let targetNormal: TaskForParallelInsertion | null = null;
  let normalLibresCount = 0;
  
  for (let i = 0; i < futureNormalTasks.length; i++) {
    const normalTask = futureNormalTasks[i];
    
    if (!normalWithUrgent.has(normalTask.id)) {
      // Esta NORMAL está libre, verificar si no tiene HIGH ya
      const hasHighAlready = futureHighTasks.some(highTask => {
        const timeDifference = Math.abs(
          highTask.startDate.getTime() - normalTask.startDate.getTime()
        );
        return timeDifference < 24 * 60 * 60 * 1000; // En paralelo
      });
      
      if (!hasHighAlready) {
        normalLibresCount++;
        
        // ✅ BUSCAR LA SEGUNDA NORMAL LIBRE (no la primera)
        if (normalLibresCount === 2) {
          targetNormalIndex = i;
          targetNormal = normalTask;
          console.log(`   ✅ Segunda NORMAL futura libre encontrada: "${normalTask.name}" (posición global ${i})`);
          break;
        } else {
          console.log(`   ⚠️ Primera NORMAL futura libre: "${normalTask.name}" - saltando para buscar la segunda`);
        }
      } else {
        console.log(`   ⚠️ NORMAL futura "${normalTask.name}" libre de URGENT pero ya tiene HIGH`);
      }
    }
  }
  
  let newStartDate: Date;
  let insertionReason = '';
  let parallelWithTask: TaskForParallelInsertion | null = null;
  
  if (targetNormal) {
    // Encontramos la segunda NORMAL libre entre las futuras
    parallelWithTask = targetNormal;
    insertionReason = `HIGH: Paralelo con "${targetNormal.name}" (segunda NORMAL futura libre, posición ${targetNormalIndex})`;
    
    // ✅ Usar la MISMA fecha de inicio para verdadero paralelismo
    newStartDate = new Date(targetNormal.startDate);
    console.log(`   🔗 Verdadero paralelo: usando exactamente la misma fecha de inicio que "${targetNormal.name}"`);
    
  } else {
    // No hay segunda NORMAL libre entre las futuras, usar la primera disponible o ir al final
    if (normalLibresCount === 1) {
      // Solo hay una NORMAL libre, usar esa
      const firstFreeNormal = futureNormalTasks.find(task => 
        !normalWithUrgent.has(task.id) && 
        !futureHighTasks.some(highTask => {
          const timeDifference = Math.abs(
            highTask.startDate.getTime() - task.startDate.getTime()
          );
          return timeDifference < 24 * 60 * 60 * 1000;
        })
      );
      
      if (firstFreeNormal) {
        parallelWithTask = firstFreeNormal;
        insertionReason = `HIGH: Paralelo con "${firstFreeNormal.name}" (única NORMAL futura libre)`;
        newStartDate = new Date(firstFreeNormal.startDate);
        console.log(`   🔗 Solo una NORMAL libre, usando: "${firstFreeNormal.name}"`);
      } else {
        // Ir al final
        const lastFutureTask = futureTasks[futureTasks.length - 1];
        parallelWithTask = lastFutureTask;
        insertionReason = `HIGH: Después de última tarea futura "${lastFutureTask.name}"`;
        newStartDate = await getNextAvailableStart(lastFutureTask.deadline);
        console.log(`   📅 No hay NORMAL libres, yendo al final de tareas futuras`);
      }
    } else {
      // No hay NORMAL libres o ir después de la última tarea futura
      if (futureTasks.length > 0) {
        const lastFutureTask = futureTasks[futureTasks.length - 1];
        parallelWithTask = lastFutureTask;
        insertionReason = `HIGH: Después de última tarea futura "${lastFutureTask.name}" (todas las NORMAL ocupadas)`;
        newStartDate = await getNextAvailableStart(lastFutureTask.deadline);
        console.log(`   📅 Todas las NORMAL futuras ocupadas, yendo al final`);
      } else {
        // No debería llegar aquí, pero por seguridad
        newStartDate = await getNextAvailableStart(new Date());
        insertionReason = `HIGH: Primera tarea (sin tareas futuras)`;
      }
    }
  }
  
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    parallelWith: parallelWithTask ? {
      taskId: parallelWithTask.id,
      taskName: parallelWithTask.name,
      originalStartDate: parallelWithTask.startDate
    } : undefined,
    noTasksAffected: true
  };
}

/**
 * 🔵 NORMAL: Mantiene comportamiento actual pero solo considera tareas futuras para LOW del mismo día
 */
async function handleNormalParallel(
  allUserTasks: TaskForParallelInsertion[], 
  futureTasks: TaskForParallelInsertion[],
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔵 NORMAL: Comportamiento actual + mover LOW del mismo día (solo tareas futuras)');
  
  if (allUserTasks.length === 0) {
    const newStartDate = await getNextAvailableStart(new Date());
    const taskHours = durationDays * 8;
    const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
    
    return {
      startDate: newStartDate,
      deadline: newDeadline,
      insertionReason: 'NORMAL: Primera tarea del usuario',
      noTasksAffected: true
    };
  }
  
  // ✅ NUEVA LÓGICA: Identificar tareas LOW creadas HOY que deben ser movidas (solo entre futuras)
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  const futureLowTasksToday = futureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt >= todayStart && taskCreatedAt < todayEnd;
  });
  
  console.log(`   📊 Tareas LOW futuras de hoy que pueden ser movidas: ${futureLowTasksToday.length}`);
  
  // ✅ CALCULAR POSICIÓN SIN LAS LOW DEL DÍA (temporalmente las excluimos, solo futuras)
  const futureTasksWithoutTodaysLow = futureTasks.filter(task => {
    if (task.priority !== 'LOW') return true;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt < todayStart; // Solo LOW de días anteriores
  });
  
  console.log(`   📊 Tareas futuras sin LOW de hoy: ${futureTasksWithoutTodaysLow.length}`);
  
  // ✅ LÓGICA DE INTERCALADO EXISTENTE (sin las LOW de hoy, solo futuras)
  let insertAfterIndex = -1;
  let insertionReason = '';
  
  for (let i = futureTasksWithoutTodaysLow.length - 1; i >= 0; i--) {
    const task = futureTasksWithoutTodaysLow[i];
    
    if (task.priority === 'LOW') {
      const normalsBefore = futureTasksWithoutTodaysLow.slice(0, i)
        .filter(t => t.priority === 'NORMAL').length;
      
      if (normalsBefore < 5) {
        insertAfterIndex = i - 1;
        insertionReason = `NORMAL: Intercalado antes de LOW futura "${task.name}" (${normalsBefore}/5)`;
        break;
      }
    }
  }
  
  if (insertAfterIndex === -1) {
    insertAfterIndex = futureTasksWithoutTodaysLow.length - 1;
    insertionReason = 'NORMAL: Al final de las tareas futuras (sin LOW de hoy)';
  }
  
  // ✅ CALCULAR FECHA DE LA NUEVA TAREA NORMAL
  const insertAfterDate = insertAfterIndex >= 0 ? 
    futureTasksWithoutTodaysLow[insertAfterIndex].deadline : new Date();
  
  const newStartDate = await getNextAvailableStart(insertAfterDate);
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  // ✅ PREPARAR MOVIMIENTO DE TAREAS LOW DEL MISMO DÍA (solo futuras)
  const tasksToMove: { taskId: string; newStartDate: Date; newDeadline: Date }[] = [];
  
  if (futureLowTasksToday.length > 0) {
    console.log(`   🔄 Preparando movimiento de ${futureLowTasksToday.length} tareas LOW futuras al final`);
    
    let currentDate = newDeadline; // Empezar después de la nueva NORMAL
    
    for (const lowTask of futureLowTasksToday) {
      const lowDuration = lowTask.customDuration ?? lowTask.category.tierList.duration;
      const lowHours = lowDuration * 8;
      
      const lowStartDate = await getNextAvailableStart(currentDate);
      const lowDeadline = await calculateWorkingDeadline(lowStartDate, lowHours);
      
      tasksToMove.push({
        taskId: lowTask.id,
        newStartDate: lowStartDate,
        newDeadline: lowDeadline
      });
      
      console.log(`     📋 LOW futura "${lowTask.name}" será movida a: ${lowStartDate.toISOString()} → ${lowDeadline.toISOString()}`);
      
      currentDate = lowDeadline;
    }
    
    insertionReason += ` (${futureLowTasksToday.length} LOW futuras del día movidas al final)`;
  }
  
  console.log(`   📅 Fecha calculada para NORMAL: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ Tareas LOW futuras del día serán reposicionadas: ${tasksToMove.length}`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    noTasksAffected: tasksToMove.length === 0,
    tasksToMove: tasksToMove.length > 0 ? tasksToMove : undefined
  };
}

/**
 * 🟢 LOW: SIEMPRE va al final del día (muy simple)
 */
async function handleLowParallel(
  futureTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟢 LOW: SIEMPRE va al final del día (será movida por NORMAL si es necesario) - SOLO TAREAS FUTURAS');
  
  const now = new Date();
  const currentHour = now.getHours();
  const isEndOfDay = currentHour >= 17; // 5:00 PM
  
  if (isEndOfDay) {
    console.log('   🕐 Fin del día: LOW se comporta como NORMAL (fecha fija)');
    // Después de las 5 PM, se comporta como NORMAL
    const result = await handleNormalParallel(futureTasks, futureTasks, durationDays);
    result.insertionReason = `LOW (post-5PM): ${result.insertionReason}`;
    return result;
  }
  
  console.log('   🕐 Durante el día: LOW va al final de tareas futuras (puede ser movida por NORMAL futuras)');
  
  // ✅ SIMPLIFICADO: LOW siempre al final de las tareas futuras
  let newStartDate: Date;
  let insertionReason: string;
  
  if (futureTasks.length > 0) {
    const lastFutureTask = futureTasks[futureTasks.length - 1];
    newStartDate = await getNextAvailableStart(lastFutureTask.deadline);
    insertionReason = `LOW: Al final después de última tarea futura "${lastFutureTask.name}" (puede ser movida por NORMAL del mismo día)`;
  } else {
    newStartDate = await getNextAvailableStart(new Date());
    insertionReason = 'LOW: Primera tarea futura (puede ser movida por NORMAL del mismo día)';
  }
  
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ⚠️ Puede ser movida si llegan NORMAL el mismo día hasta 5PM`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    noTasksAffected: true
  };
}

/**
 * 🎯 FUNCIÓN PRINCIPAL: Calcular inserción en paralelo CON VACACIONES + SOLO TAREAS FUTURAS
 */
export async function calculateParallelPriorityInsertion(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log(`\n🎯 === CÁLCULO DE INSERCIÓN EN PARALELO + VACACIONES + SOLO TAREAS FUTURAS ===`);
  console.log(`👤 Usuario: ${userId}`);
  console.log(`🔥 Prioridad: ${priority}`);
  console.log(`⏱️ Duración: ${durationDays} días`);
  console.log(`✅ NO se afectarán tareas existentes (excepto LOW del mismo día para NORMAL)`);
  console.log(`🏖️ SE considerarán vacaciones del usuario`);
  console.log(`📅 NUEVA LÓGICA: Solo considera tareas desde fecha actual hacia adelante`);
  console.log(`🔒 Tareas del pasado se ignoran completamente`);
  
  // ✅ OBTENER TODAS LAS TAREAS CON FECHA DE CREACIÓN
  const allUserTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      deadline: true,
      priority: true,
      customDuration: true,
      createdAt: true,
      category: {
        include: {
          tierList: {
            select: {
              duration: true
            }
          }
        }
      }
    }
  }) as unknown as (TaskForParallelInsertion & { createdAt: Date })[];
  
  // ✅ FILTRAR SOLO TAREAS FUTURAS (desde hoy hacia adelante)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const futureTasks = allUserTasks.filter(task => {
    const taskStartDate = new Date(task.startDate);
    return taskStartDate >= todayStart;
  });
  
  console.log(`📊 Análisis de tareas:`);
  console.log(`   📋 Tareas totales del usuario: ${allUserTasks.length}`);
  console.log(`   🔮 Tareas futuras (desde hoy): ${futureTasks.length}`);
  console.log(`   🕒 Tareas del pasado (ignoradas): ${allUserTasks.length - futureTasks.length}`);
  
  if (allUserTasks.length - futureTasks.length > 0) {
    console.log(`   ⚠️ Se ignoraron ${allUserTasks.length - futureTasks.length} tareas del pasado para cálculo de paralelos`);
  }
  
  // ✅ MOSTRAR ANÁLISIS DE TAREAS LOW POR FECHA (solo futuras)
  const today = new Date();
  const todayStartForLow = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStartForLow.getTime() + 24 * 60 * 60 * 1000);
  
  const futureLowTasksToday = futureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt >= todayStartForLow && taskCreatedAt < todayEnd;
  });
  
  const futureLowTasksPrevious = futureTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt);
    return taskCreatedAt < todayStartForLow;
  });
  
  console.log(`📋 Análisis de tareas LOW futuras:`);
  console.log(`   🟢 LOW futuras de hoy (intercalables): ${futureLowTasksToday.length}`);
  console.log(`   🔒 LOW futuras de días anteriores (fijas): ${futureLowTasksPrevious.length}`);
  
  if (futureLowTasksToday.length > 0) {
    console.log(`   📅 LOW futuras del día actual:`);
    futureLowTasksToday.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  if (futureLowTasksPrevious.length > 0) {
    console.log(`   🔒 LOW futuras de días anteriores (NO intercalables):`);
    futureLowTasksPrevious.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  // Calcular inserción según prioridad (SIN vacaciones primero, solo con tareas futuras)
  let result: ParallelInsertionResult;
  
  switch (priority) {
    case 'URGENT':
      result = await handleUrgentParallel(futureTasks, durationDays);
      break;
    case 'HIGH':
      result = await handleHighParallel(futureTasks, durationDays);
      break;
    case 'NORMAL':
      result = await handleNormalParallel(allUserTasks, futureTasks, durationDays); // Pasar ambas para contexto
      break;
    case 'LOW':
      result = await handleLowParallel(futureTasks, durationDays);
      break;
    default:
      throw new Error(`Prioridad desconocida: ${priority}`);
  }
  
  console.log(`\n📅 === FECHAS ANTES DE VACACIONES (SOLO TAREAS FUTURAS) ===`);
  console.log(`📅 Inicio: ${result.startDate.toISOString()}`);
  console.log(`📅 Fin: ${result.deadline.toISOString()}`);
  console.log(`💭 Razón: ${result.insertionReason}`);
  
  // ✅ MOSTRAR TAREAS QUE SERÁN MOVIDAS
  if (result.tasksToMove && result.tasksToMove.length > 0) {
    console.log(`\n🔄 === TAREAS LOW FUTURAS QUE SERÁN MOVIDAS ===`);
    result.tasksToMove.forEach(task => {
      console.log(`   📋 ${task.taskId}: ${task.newStartDate.toISOString()} → ${task.newDeadline.toISOString()}`);
    });
  }
  
  // ✅ APLICAR LÓGICA DE VACACIONES
  const finalResult = await applyVacationLogic(userId, result, durationDays);
  
  console.log(`\n✅ === RESULTADO FINAL CON VACACIONES (SOLO TAREAS FUTURAS) ===`);
  console.log(`📅 Inicio: ${finalResult.startDate.toISOString()}`);
  console.log(`📅 Fin: ${finalResult.deadline.toISOString()}`);
  console.log(`💭 Razón: ${finalResult.insertionReason}`);
  console.log(`✅ Tareas afectadas: ${finalResult.tasksToMove?.length || 0} LOW futuras del mismo día`);
  console.log(`🏖️ Vacaciones consideradas: SÍ`);
  console.log(`🔮 Solo tareas futuras consideradas: SÍ`);
  
  if (finalResult.vacationAdjustment) {
    console.log(`\n🏖️ === AJUSTES POR VACACIONES ===`);
    console.log(`📅 Fecha original: ${finalResult.vacationAdjustment.originalDate.toISOString()}`);
    console.log(`📅 Fecha ajustada: ${finalResult.vacationAdjustment.adjustedDate.toISOString()}`);
    console.log(`🏖️ Conflictos: ${finalResult.vacationAdjustment.conflictingVacations.join(', ')}`);
  }
  
  if (finalResult.parallelWith) {
    console.log(`🔗 Paralelo con tarea futura: "${finalResult.parallelWith.taskName}"`);
    console.log(`📅 Fecha original de referencia: ${finalResult.parallelWith.originalStartDate.toISOString()}`);
  }
  
  return finalResult;
}

/**
 * 🎯 FUNCIÓN AUXILIAR: Obtener información de paralelismo (solo tareas futuras)
 */
export async function getParallelismInfo(
  userId: string,
  priority: Priority
): Promise<{
  currentUrgentCount: number;
  currentHighCount: number;
  currentNormalCount: number;
  currentLowCount: number;
  nextInsertionWillBeParallel: boolean;
  estimatedParallelWith?: string;
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // ✅ SOLO CONSIDERAR TAREAS FUTURAS
  const futureTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] },
      startDate: { gte: todayStart } // ✅ SOLO TAREAS FUTURAS
    },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      name: true,
      priority: true,
      startDate: true
    }
  });
  
  const priorityCounts = {
    currentUrgentCount: futureTasks.filter(t => t.priority === 'URGENT').length,
    currentHighCount: futureTasks.filter(t => t.priority === 'HIGH').length,
    currentNormalCount: futureTasks.filter(t => t.priority === 'NORMAL').length,
    currentLowCount: futureTasks.filter(t => t.priority === 'LOW').length,
    nextInsertionWillBeParallel: ['URGENT', 'HIGH'].includes(priority),
    estimatedParallelWith: undefined as string | undefined
  };
  
  // Calcular con qué tarea futura será paralelo
  if (priority === 'URGENT') {
    const firstFutureTask = futureTasks[0];
    priorityCounts.estimatedParallelWith = firstFutureTask ? 
      `Primera tarea futura: ${firstFutureTask.name}` : 
      'Será la primera tarea';
  } else if (priority === 'HIGH') {
    const futureNormalTasks = futureTasks.filter(t => t.priority === 'NORMAL');
    const futureHighTasks = futureTasks.filter(t => t.priority === 'HIGH');
    
    if (futureNormalTasks.length >= 2) {
      priorityCounts.estimatedParallelWith = `Segunda NORMAL futura: ${futureNormalTasks[1].name}`;
    } else if (futureNormalTasks.length === 1) {
      priorityCounts.estimatedParallelWith = `Única NORMAL futura: ${futureNormalTasks[0].name}`;
    } else {
      priorityCounts.estimatedParallelWith = 'Después de última tarea futura';
    }
  }
  
  return priorityCounts;
}