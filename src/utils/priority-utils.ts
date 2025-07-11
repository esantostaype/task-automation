// utils/priority-utils.ts
import { Task, Priority } from '@prisma/client';

/**
 * Devuelve la posición en la cola donde debe insertarse una nueva tarea
 * según su prioridad y el estado actual de la cola del usuario.
 * 
 * Reglas de prioridad:
 * - URGENT: Siempre al inicio (posición 0)
 * - HIGH: Al inicio si la primera tarea es tier C, B, A, o S; después de la primera si es tier D o E
 * - NORMAL: Después de otras tareas NORMAL, pero antes de LOW (máximo 5 NORMAL antes de cada LOW)
 * - LOW: Al final, pero permite hasta 4 tareas LOW consecutivas
 */
export function determineQueueInsertPosition(
  queue: (Task & { category: { tierList: { name: string } } })[],  // ✅ CORREGIDO
  priority: Priority
): number {
  console.log(`🎯 Determinando posición para prioridad: ${priority}, cola actual: ${queue.length} tareas`);

  if (priority === 'URGENT') {
    console.log(`  -> URGENT: Insertando en posición 0`);
    return 0;
  }

  if (priority === 'HIGH') {
    if (queue.length === 0) {
      console.log(`  -> HIGH: Cola vacía, insertando en posición 0`);
      return 0;
    }

    const firstTask = queue[0];
    const firstTaskTier = firstTask.category?.tierList?.name; // ✅ CORREGIDO
    
    console.log(`  -> HIGH: Primera tarea tiene tier "${firstTaskTier}"`);

    if (firstTaskTier && ['C', 'B', 'A', 'S'].includes(firstTaskTier)) {
      console.log(`  -> HIGH: Tier alto detectado, insertando en posición 0`);
      return 0;
    }
    
    if (firstTaskTier && ['D', 'E'].includes(firstTaskTier)) {
      console.log(`  -> HIGH: Tier bajo detectado, insertando en posición 1`);
      return 1;
    }

    console.log(`  -> HIGH: Fallback, insertando en posición 0`);
    return 0;
  }

  // LOW: Insertar al final, pero con límite de tareas LOW consecutivas
  if (priority === 'LOW') {
    // Contar tareas LOW consecutivas al final
    let consecutiveLowCount = 0;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].priority === 'LOW') {
        consecutiveLowCount++;
      } else {
        break;
      }
    }

    console.log(`  -> LOW: ${consecutiveLowCount} tareas LOW consecutivas al final`);

    // Si hay menos de 4 tareas LOW consecutivas, insertar al final
    if (consecutiveLowCount < 4) {
      console.log(`  -> LOW: Insertando al final en posición ${queue.length}`);
      return queue.length;
    }

    // Si ya hay 4 o más, insertar antes del grupo de LOW
    const insertPosition = queue.length - consecutiveLowCount;
    console.log(`  -> LOW: Límite alcanzado, insertando en posición ${insertPosition}`);
    return insertPosition;
  }

  // NORMAL: Lógica más compleja
  if (priority === 'NORMAL') {
    let potentialInsertIndex = queue.length; // Por defecto al final

    for (let i = 0; i < queue.length; i++) {
      const currentTask = queue[i];

      if (currentTask.priority === 'LOW') {
        // Contar cuántas tareas NORMAL hay antes de esta LOW
        let normalTasksBeforeThisLow = 0;
        for (let j = 0; j < i; j++) {
          if (queue[j].priority === 'NORMAL') {
            normalTasksBeforeThisLow++;
          }
        }

        console.log(`  -> NORMAL: Encontrada LOW en posición ${i}, ${normalTasksBeforeThisLow} NORMAL antes`);

        // Si hay menos de 5 tareas NORMAL antes de esta LOW, insertar aquí
        if (normalTasksBeforeThisLow < 5) {
          potentialInsertIndex = i;
          break;
        }
        
        // Si ya hay 5 o más, continuar después de esta LOW
        potentialInsertIndex = i + 1;
      } else if (currentTask.priority === 'NORMAL') {
        // Para mantener el orden, insertar después de otras tareas NORMAL
        potentialInsertIndex = i + 1;
      }
      // Para HIGH y URGENT, no cambiar la posición (mantenemos potentialInsertIndex)
    }

    console.log(`  -> NORMAL: Insertando en posición ${potentialInsertIndex}`);
    return potentialInsertIndex;
  }

  // Fallback: insertar al final
  console.log(`  -> Fallback: Insertando al final en posición ${queue.length}`);
  return queue.length;
}

/**
 * Función auxiliar para depurar la cola de tareas
 */
export function debugQueue(queue: (Task & { category: { tierList: { name: string } } })[]): void { // ✅ CORREGIDO
  console.log('📋 Estado actual de la cola:');
  queue.forEach((task, index) => {
    console.log(`  ${index}: "${task.name}" - ${task.priority} (Tier: ${task.category.tierList.name})`); // ✅ CORREGIDO
  });
}