// src/services/parallel-priority-insertion.service.ts
// 🎯 NUEVA LÓGICA: Prioridades en paralelo sin empujar fechas + VACACIONES

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
  createdAt: Date; // ✅ AÑADIR FECHA DE CREACIÓN
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
  tasksToMove?: { taskId: string; newStartDate: Date; newDeadline: Date }[]; // ✅ NUEVO: Para NORMAL
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
 * 🔴 URGENT: Inserción en paralelo con todas las tareas
 */
async function handleUrgentParallel(
  userTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔴 URGENT: Inserción en paralelo (no empuja tareas)');
  
  // Siempre empieza lo más pronto posible
  const newStartDate = await getNextAvailableStart(new Date());
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason: 'URGENT: Paralelo inmediato, no afecta tareas existentes',
    noTasksAffected: true
  };
}

/**
 * 🟡 HIGH: Inserción en paralelo con lógica zebra (evitando NORMAL con URGENT)
 */
async function handleHighParallel(
  userTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟡 HIGH: Inserción en paralelo con lógica zebra (evitando NORMAL con URGENT)');
  
  if (userTasks.length === 0) {
    return handleUrgentParallel([], durationDays);
  }
  
  // Filtrar tareas por prioridad
  const normalTasks = userTasks.filter(task => task.priority === 'NORMAL');
  const highTasks = userTasks.filter(task => task.priority === 'HIGH');
  const urgentTasks = userTasks.filter(task => task.priority === 'URGENT');
  
  console.log(`   📊 Tareas NORMAL existentes: ${normalTasks.length}`);
  console.log(`   📊 Tareas HIGH existentes: ${highTasks.length}`);
  console.log(`   📊 Tareas URGENT existentes: ${urgentTasks.length}`);
  
  // ✅ NUEVA LÓGICA: Identificar qué NORMAL ya tienen URGENT en paralelo
  const normalWithUrgent = new Set<string>();
  
  // Buscar URGENT que están en paralelo con NORMAL
  urgentTasks.forEach(urgentTask => {
    normalTasks.forEach(normalTask => {
      // Verificar si tienen fechas de inicio muy similares (en paralelo)
      const timeDifference = Math.abs(
        urgentTask.startDate.getTime() - normalTask.startDate.getTime()
      );
      const isParallel = timeDifference < 24 * 60 * 60 * 1000; // Menos de 1 día de diferencia
      
      if (isParallel) {
        normalWithUrgent.add(normalTask.id);
        console.log(`   🔴 NORMAL "${normalTask.name}" ya tiene URGENT "${urgentTask.name}" en paralelo`);
      }
    });
  });
  
  // ✅ BUSCAR PRIMERA NORMAL LIBRE (sin URGENT en paralelo)
  let targetNormalIndex = -1;
  let targetNormal: TaskForParallelInsertion | null = null;
  
  for (let i = 0; i < normalTasks.length; i++) {
    const normalTask = normalTasks[i];
    
    if (!normalWithUrgent.has(normalTask.id)) {
      // Esta NORMAL está libre, verificar si no tiene HIGH ya
      const hasHighAlready = highTasks.some(highTask => {
        const timeDifference = Math.abs(
          highTask.startDate.getTime() - normalTask.startDate.getTime()
        );
        return timeDifference < 24 * 60 * 60 * 1000; // En paralelo
      });
      
      if (!hasHighAlready) {
        targetNormalIndex = i;
        targetNormal = normalTask;
        console.log(`   ✅ NORMAL libre encontrada: "${normalTask.name}" (posición ${i})`);
        break;
      } else {
        console.log(`   ⚠️ NORMAL "${normalTask.name}" libre de URGENT pero ya tiene HIGH`);
      }
    }
  }
  
  let newStartDate: Date;
  let insertionReason = '';
  let parallelWithTask: TaskForParallelInsertion | null = null;
  
  if (targetNormal) {
    // Encontramos una NORMAL libre
    parallelWithTask = targetNormal;
    insertionReason = `HIGH: Paralelo con "${targetNormal.name}" (primera NORMAL libre, posición ${targetNormalIndex})`;
    
    // ✅ Usar la MISMA fecha de inicio para verdadero paralelismo
    newStartDate = new Date(targetNormal.startDate);
    console.log(`   🔗 Verdadero paralelo: usando exactamente la misma fecha de inicio que "${targetNormal.name}"`);
    
  } else {
    // No hay NORMAL libres, ir después de la última tarea
    const lastTask = userTasks[userTasks.length - 1];
    parallelWithTask = lastTask;
    insertionReason = `HIGH: Después de última tarea "${lastTask.name}" (todas las NORMAL ocupadas)`;
    
    newStartDate = await getNextAvailableStart(lastTask.deadline);
    console.log(`   📅 Todas las NORMAL ocupadas, yendo al final`);
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
 * 🔵 NORMAL: Mantiene comportamiento actual
 */
async function handleNormalParallel(
  userTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🔵 NORMAL: Comportamiento actual mantenido');
  
  if (userTasks.length === 0) {
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
  
  // Lógica de intercalado con LOW (sin cambios)
  let insertAfterIndex = -1;
  let insertionReason = '';
  
  for (let i = userTasks.length - 1; i >= 0; i--) {
    const task = userTasks[i];
    
    if (task.priority === 'LOW') {
      const normalsBefore = userTasks.slice(0, i)
        .filter(t => t.priority === 'NORMAL').length;
      
      if (normalsBefore < 5) {
        insertAfterIndex = i - 1;
        insertionReason = `NORMAL: Intercalado antes de LOW "${task.name}" (${normalsBefore}/5)`;
        break;
      }
    }
  }
  
  if (insertAfterIndex === -1) {
    insertAfterIndex = userTasks.length - 1;
    insertionReason = 'NORMAL: Al final de la cola';
  }
  
  const insertAfterDate = insertAfterIndex >= 0 ? 
    userTasks[insertAfterIndex].deadline : new Date();
  
  const newStartDate = await getNextAvailableStart(insertAfterDate);
  const taskHours = durationDays * 8;
  const newDeadline = await calculateWorkingDeadline(newStartDate, taskHours);
  
  console.log(`   📅 Fecha calculada: ${newStartDate.toISOString()} → ${newDeadline.toISOString()}`);
  console.log(`   ✅ NO se afectan tareas existentes`);
  
  return {
    startDate: newStartDate,
    deadline: newDeadline,
    insertionReason,
    noTasksAffected: true
  };
}

/**
 * 🟢 LOW: SIEMPRE va al final del día (muy simple)
 */
async function handleLowParallel(
  userTasks: TaskForParallelInsertion[], 
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log('🟢 LOW: SIEMPRE va al final del día (será movida por NORMAL si es necesario)');
  
  const now = new Date();
  const currentHour = now.getHours();
  const isEndOfDay = currentHour >= 17; // 5:00 PM
  
  if (isEndOfDay) {
    console.log('   🕐 Fin del día: LOW se comporta como NORMAL (fecha fija)');
    // Después de las 5 PM, se comporta como NORMAL
    const result = await handleNormalParallel(userTasks, durationDays);
    result.insertionReason = `LOW (post-5PM): ${result.insertionReason}`;
    return result;
  }
  
  console.log('   🕐 Durante el día: LOW va al final (puede ser movida por NORMAL futuras)');
  
  // ✅ SIMPLIFICADO: LOW siempre al final
  let newStartDate: Date;
  let insertionReason: string;
  
  if (userTasks.length > 0) {
    const lastTask = userTasks[userTasks.length - 1];
    newStartDate = await getNextAvailableStart(lastTask.deadline);
    insertionReason = `LOW: Al final después de "${lastTask.name}" (puede ser movida por NORMAL del mismo día)`;
  } else {
    newStartDate = await getNextAvailableStart(new Date());
    insertionReason = 'LOW: Primera tarea (puede ser movida por NORMAL del mismo día)';
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
 * 🎯 FUNCIÓN PRINCIPAL: Calcular inserción en paralelo CON VACACIONES
 */
export async function calculateParallelPriorityInsertion(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<ParallelInsertionResult> {
  console.log(`\n🎯 === CÁLCULO DE INSERCIÓN EN PARALELO + VACACIONES ===`);
  console.log(`👤 Usuario: ${userId}`);
  console.log(`🔥 Prioridad: ${priority}`);
  console.log(`⏱️ Duración: ${durationDays} días`);
  console.log(`✅ NO se afectarán tareas existentes`);
  console.log(`🏖️ SE considerarán vacaciones del usuario`);
  console.log(`📅 NUEVA LÓGICA: LOW solo intercala con tareas del mismo día`);
  console.log(`🔒 LOW de días anteriores se comportan como NORMAL (fechas fijas)`);
  
  // Obtener timeline actual CON FECHA DE CREACIÓN
  const userTasks = await prisma.task.findMany({
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
      createdAt: true, // ✅ INCLUIR FECHA DE CREACIÓN
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
  
  console.log(`📊 Tareas existentes: ${userTasks.length}`);
  
  // ✅ MOSTRAR ANÁLISIS DE TAREAS LOW POR FECHA
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  const lowTasksToday = userTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt); // ✅ USAR CAMPO DIRECTO
    return taskCreatedAt >= todayStart && taskCreatedAt < todayEnd;
  });
  
  const lowTasksPrevious = userTasks.filter(task => {
    if (task.priority !== 'LOW') return false;
    const taskCreatedAt = new Date(task.createdAt); // ✅ USAR CAMPO DIRECTO
    return taskCreatedAt < todayStart;
  });
  
  console.log(`📋 Análisis de tareas LOW:`);
  console.log(`   🟢 LOW de hoy (intercalables): ${lowTasksToday.length}`);
  console.log(`   🔒 LOW de días anteriores (fijas): ${lowTasksPrevious.length}`);
  
  if (lowTasksToday.length > 0) {
    console.log(`   📅 LOW del día actual:`);
    lowTasksToday.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  if (lowTasksPrevious.length > 0) {
    console.log(`   🔒 LOW de días anteriores (NO intercalables):`);
    lowTasksPrevious.forEach(task => {
      console.log(`     - "${task.name}": ${task.startDate.toISOString()}`);
    });
  }
  
  // Calcular inserción según prioridad (SIN vacaciones primero)
  let result: ParallelInsertionResult;
  
  switch (priority) {
    case 'URGENT':
      result = await handleUrgentParallel(userTasks, durationDays);
      break;
    case 'HIGH':
      result = await handleHighParallel(userTasks, durationDays);
      break;
    case 'NORMAL':
      result = await handleNormalParallel(userTasks, durationDays);
      break;
    case 'LOW':
      result = await handleLowParallel(userTasks, durationDays);
      break;
    default:
      throw new Error(`Prioridad desconocida: ${priority}`);
  }
  
  console.log(`\n📅 === FECHAS ANTES DE VACACIONES ===`);
  console.log(`📅 Inicio: ${result.startDate.toISOString()}`);
  console.log(`📅 Fin: ${result.deadline.toISOString()}`);
  console.log(`💭 Razón: ${result.insertionReason}`);
  
  // ✅ APLICAR LÓGICA DE VACACIONES
  const finalResult = await applyVacationLogic(userId, result, durationDays);
  
  console.log(`\n✅ === RESULTADO FINAL CON VACACIONES ===`);
  console.log(`📅 Inicio: ${finalResult.startDate.toISOString()}`);
  console.log(`📅 Fin: ${finalResult.deadline.toISOString()}`);
  console.log(`💭 Razón: ${finalResult.insertionReason}`);
  console.log(`✅ Tareas afectadas: NINGUNA`);
  console.log(`🏖️ Vacaciones consideradas: SÍ`);
  
  if (finalResult.vacationAdjustment) {
    console.log(`\n🏖️ === AJUSTES POR VACACIONES ===`);
    console.log(`📅 Fecha original: ${finalResult.vacationAdjustment.originalDate.toISOString()}`);
    console.log(`📅 Fecha ajustada: ${finalResult.vacationAdjustment.adjustedDate.toISOString()}`);
    console.log(`🏖️ Conflictos: ${finalResult.vacationAdjustment.conflictingVacations.join(', ')}`);
  }
  
  if (finalResult.parallelWith) {
    console.log(`🔗 Paralelo con: "${finalResult.parallelWith.taskName}"`);
    console.log(`📅 Fecha original de referencia: ${finalResult.parallelWith.originalStartDate.toISOString()}`);
  }
  
  return finalResult;
}

/**
 * 🎯 FUNCIÓN AUXILIAR: Obtener información de paralelismo
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
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      status: { notIn: ['COMPLETE'] }
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
    currentUrgentCount: userTasks.filter(t => t.priority === 'URGENT').length,
    currentHighCount: userTasks.filter(t => t.priority === 'HIGH').length,
    currentNormalCount: userTasks.filter(t => t.priority === 'NORMAL').length,
    currentLowCount: userTasks.filter(t => t.priority === 'LOW').length,
    nextInsertionWillBeParallel: ['URGENT', 'HIGH'].includes(priority),
    estimatedParallelWith: undefined as string | undefined
  };
  
  // Calcular con qué tarea será paralelo
  if (priority === 'URGENT') {
    priorityCounts.estimatedParallelWith = 'Todas las tareas existentes';
  } else if (priority === 'HIGH') {
    const normalTasks = userTasks.filter(t => t.priority === 'NORMAL');
    const highTasks = userTasks.filter(t => t.priority === 'HIGH');
    const nextPosition = highTasks.length;
    
    if (nextPosition < normalTasks.length) {
      priorityCounts.estimatedParallelWith = normalTasks[nextPosition].name;
    } else {
      priorityCounts.estimatedParallelWith = 'Después de última tarea';
    }
  }
  
  return priorityCounts;
}