// utils/priority-utils.ts - SIMPLIFICADO SIN queuePosition
import { Task, Priority } from '@prisma/client';

/**
 * ✅ SIMPLIFICADO: Determina dónde insertar una tarea basado solo en prioridad y fechas
 * Ya no necesitamos calcular posiciones de cola específicas, solo ordenamiento por fechas
 */
export function shouldInsertBefore(
  newTaskPriority: Priority,
  existingTaskPriority: Priority,
  newTaskStartDate: Date,
  existingTaskStartDate: Date
): boolean {
  console.log(`🎯 Comparando prioridades: nueva(${newTaskPriority}) vs existente(${existingTaskPriority})`);

  // ✅ LÓGICA SIMPLIFICADA DE PRIORIDADES
  const priorityValues = {
    'URGENT': 4,
    'HIGH': 3,
    'NORMAL': 2,
    'LOW': 1
  };

  const newPriorityValue = priorityValues[newTaskPriority];
  const existingPriorityValue = priorityValues[existingTaskPriority];

  // Si la nueva tarea tiene mayor prioridad, va antes
  if (newPriorityValue > existingPriorityValue) {
    console.log(`  -> Nueva tarea tiene mayor prioridad, insertando antes`);
    return true;
  }

  // Si tienen la misma prioridad, ordenar por fecha
  if (newPriorityValue === existingPriorityValue) {
    const shouldInsert = newTaskStartDate < existingTaskStartDate;
    console.log(`  -> Misma prioridad, ordenando por fecha: ${shouldInsert ? 'antes' : 'después'}`);
    return shouldInsert;
  }

  // Si la nueva tarea tiene menor prioridad, va después
  console.log(`  -> Nueva tarea tiene menor prioridad, insertando después`);
  return false;
}

/**
 * ✅ FUNCIÓN SIMPLIFICADA: Ordenar tareas por prioridad y fecha
 */
export function sortTasksByPriorityAndDate(
  tasks: (Task & { category: { tierList: { name: string } } })[]
): (Task & { category: { tierList: { name: string } } })[] {
  console.log(`📋 Ordenando ${tasks.length} tareas por prioridad y fecha`);

  const priorityValues = {
    'URGENT': 4,
    'HIGH': 3,
    'NORMAL': 2,
    'LOW': 1
  };

  return tasks.sort((a, b) => {
    const aPriorityValue = priorityValues[a.priority];
    const bPriorityValue = priorityValues[b.priority];

    // Primero ordenar por prioridad (mayor a menor)
    if (aPriorityValue !== bPriorityValue) {
      return bPriorityValue - aPriorityValue;
    }

    // Si tienen la misma prioridad, ordenar por fecha de inicio (menor a mayor)
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
}

/**
 * ✅ FUNCIÓN SIMPLIFICADA: Debug de tareas ordenadas
 */
export function debugTaskOrder(tasks: (Task & { category: { tierList: { name: string } } })[]): void {
  console.log('📋 Orden actual de tareas:');
  tasks.forEach((task, index) => {
    const startDate = new Date(task.startDate).toISOString().split('T')[0];
    const deadline = new Date(task.deadline).toISOString().split('T')[0];
    
    console.log(`  ${index + 1}. "${task.name}"`);
    console.log(`     - Prioridad: ${task.priority}`);
    console.log(`     - Fechas: ${startDate} → ${deadline}`);
    console.log(`     - Tier: ${task.category.tierList.name}`);
  });
}

/**
 * ✅ FUNCIÓN DE UTILIDAD: Obtener siguiente fecha disponible para prioridad
 */
export function getInsertionDateForPriority(
  priority: Priority,
  userTasks: (Task & { category: { tierList: { name: string } } })[],
  earliestPossibleDate: Date
): Date {
  console.log(`🎯 Calculando fecha de inserción para prioridad ${priority}`);

  // Para tareas URGENT, usar la fecha más temprana posible
  if (priority === 'URGENT') {
    console.log(`  -> URGENT: usando fecha más temprana: ${earliestPossibleDate.toISOString()}`);
    return earliestPossibleDate;
  }

  // Para otras prioridades, encontrar el lugar apropiado en la secuencia
  const sortedTasks = sortTasksByPriorityAndDate(userTasks);
  
  for (let i = 0; i < sortedTasks.length; i++) {
    const currentTask = sortedTasks[i];
    const shouldInsert = shouldInsertBefore(
      priority,
      currentTask.priority,
      earliestPossibleDate,
      new Date(currentTask.startDate)
    );

    if (shouldInsert) {
      // Insertar antes de esta tarea
      const insertDate = new Date(currentTask.startDate);
      console.log(`  -> Insertando antes de "${currentTask.name}" en: ${insertDate.toISOString()}`);
      return insertDate;
    }
  }

  // Si no encontramos lugar antes de ninguna tarea, insertar al final
  if (sortedTasks.length > 0) {
    const lastTask = sortedTasks[sortedTasks.length - 1];
    const afterLastTask = new Date(lastTask.deadline);
    console.log(`  -> Insertando después de la última tarea: ${afterLastTask.toISOString()}`);
    return afterLastTask;
  }

  // Si no hay tareas, usar la fecha más temprana
  console.log(`  -> No hay tareas, usando fecha más temprana: ${earliestPossibleDate.toISOString()}`);
  return earliestPossibleDate;
}