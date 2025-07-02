// services/task-assignment.service.ts - VERSIÓN CONSERVADORA

import { prisma } from '@/utils/prisma'
import { Priority, Status } from '@prisma/client'
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult } from '@/interfaces'
import { getNextAvailableStart, calculateWorkingDeadline, shiftUserTasks } from '@/utils/task-calculation-utils'

// Nueva y única constante para el umbral de deadline para forzar al generalista
const DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST = 10; // Días: si el especialista tiene un deadline +10 días más lejano que el generalista, FORZAR al generalista.

// Las siguientes constantes y su lógica asociada han sido eliminadas para simplificar el sistema:
// const GENERALIST_CONSIDERATION_THRESHOLD_TASKS = 3;
// const SPECIALIST_DEADLINE_DIFFERENCE_THRESHOLD_TO_CONSIDER_GENERALIST = 10;
// const SPECIALIST_DEADLINE_DIFFERENCE_THRESHOLD_TO_FORCE_GENERALIST = 15;
// const SPECIALIST_DEADLINE_THRESHOLD_CLOSE_TO_TODAY = 5;
// const GENERALIST_AVAILABILITY_ADVANTAGE_MS = 1 * 24 * 60 * 60 * 1000;


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
  })

  return allUsersWithRoles.filter(user =>
    user.roles.some(role => role.typeId === typeId)
  ) as UserWithRoles[]
}

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
        status: {
          notIn: [Status.COMPLETE]
        },
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
    }) as unknown as Task[]

    const cargaTotal = tasks.length

    let availableDate: Date
    let lastTaskDeadline: Date | undefined; // Declara la nueva variable

    if (tasks.length > 0) {
      const lastTask = tasks[tasks.length - 1]
      availableDate = await getNextAvailableStart(new Date(lastTask.deadline))
      lastTaskDeadline = new Date(lastTask.deadline); // Asigna el deadline aquí
    } else {
      availableDate = await getNextAvailableStart(new Date())
    }

    const matchingRoles = user.roles.filter(role => role.typeId === typeId)
    const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1

    return {
      userId: user.id,
      userName: user.name,
      availableDate,
      tasks,
      cargaTotal,
      isSpecialist,
      lastTaskDeadline, // Incluye el nuevo campo en el objeto retornado
    }
  }))
}

export function selectBestUser(userSlots: UserSlot[]): UserSlot | null {
  const specialists = userSlots.filter(slot => slot.isSpecialist)
  const generalists = userSlots.filter(slot => !slot.isSpecialist)

  const sortUsers = (users: UserSlot[]) => {
    return users.sort((a, b) => {
      // Orden principal por carga total (menos tareas es mejor)
      // Aunque no se use para la decisión final, mantener el ordenamiento puede ser útil para logs o depuración.
      if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal
      // Orden secundario por fecha disponible (más temprano es mejor)
      return a.availableDate.getTime() - b.availableDate.getTime()
    })
  }

  const sortedSpecialists = sortUsers(specialists)
  const sortedGeneralists = sortUsers(generalists)

  const bestSpecialist: UserSlot | null = sortedSpecialists.length > 0 ? sortedSpecialists[0] : null
  const bestGeneralist: UserSlot | null = sortedGeneralists.length > 0 ? sortedGeneralists[0] : null

  // Casos base: si no hay un tipo de usuario disponible
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

  // === Lógica de Asignación Basada Exclusivamente en Deadlines Simplificada ===

  // Calcula el "deadline efectivo" para la comparación de especialista
  // Si tiene tareas, usa el deadline de la última. Si no, usa su fecha de disponibilidad (que es cercana a hoy si no hay tareas).
  let effectiveSpecialistDeadline: Date;
  if (bestSpecialist.tasks.length > 0 && bestSpecialist.lastTaskDeadline) {
    effectiveSpecialistDeadline = bestSpecialist.lastTaskDeadline;
  } else {
    effectiveSpecialistDeadline = bestSpecialist.availableDate;
  }

  // Calcula el "deadline efectivo" para la comparación de generalista
  let effectiveGeneralistDeadline: Date;
  if (bestGeneralist.tasks.length > 0 && bestGeneralist.lastTaskDeadline) {
    effectiveGeneralistDeadline = bestGeneralist.lastTaskDeadline;
  } else {
    effectiveGeneralistDeadline = bestGeneralist.availableDate;
  }

  // Calcula la diferencia en días entre los deadlines efectivos (especialista - generalista)
  const deadlineDifferenceDays = (effectiveSpecialistDeadline.getTime() - effectiveGeneralistDeadline.getTime()) / (1000 * 60 * 60 * 24);

  // ÚNICA REGLA: Si el deadline del especialista es MÁS DE 10 días más lejano que el del generalista, FORZAR al generalista.
  if (deadlineDifferenceDays > DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST) {
    console.log(`Asignación: Generalista ${bestGeneralist.userName} FORZADO sobre especialista ${bestSpecialist.userName}. Deadline del especialista (${effectiveSpecialistDeadline.toISOString()}) es más de ${DEADLINE_DIFFERENCE_TO_FORCE_GENERALIST} días más lejano que el del generalista (${effectiveGeneralistDeadline.toISOString()}). Diferencia: ${deadlineDifferenceDays.toFixed(1)} días.`);
    return bestGeneralist;
  }

  // Por defecto: Si la regla anterior no se cumple, se elige al mejor especialista.
  console.log(`Asignación: Especialista ${bestSpecialist.userName} mantenido, ya que su deadline no es excesivamente lejano en comparación con el generalista.`);
  return bestSpecialist;
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
      // Las tareas URGENT deben comenzar inmediatamente, desplazando a las demás.
      calculatedStartDate = await getNextAvailableStart(new Date())
      affectedTasks.push(...userSlot.tasks) // Todas las tareas existentes son afectadas
      break

    case 'HIGH':
      if (userSlot.tasks.length >= 1) {
        const firstTask = userSlot.tasks[0]
        const firstTaskTier = firstTask.category?.tier

        if (firstTaskTier && ['E', 'D'].includes(firstTaskTier)) {
          // Si la primera tarea es de tier bajo, insertar después de ella
          insertAt = 1
          calculatedStartDate = await getNextAvailableStart(new Date(firstTask.deadline))
          affectedTasks.push(...userSlot.tasks.slice(1)) // Las tareas desde el índice 1 en adelante son afectadas
        } else if (firstTaskTier && ['C', 'B', 'A', 'S'].includes(firstTaskTier)) {
          // Si la primera tarea es de tier alto, insertar al inicio
          insertAt = 0
          calculatedStartDate = await getNextAvailableStart(new Date()) // Comenzar inmediatamente
          affectedTasks.push(...userSlot.tasks) // Todas las tareas existentes son afectadas
        } else {
          // Si el tier no está definido o es inesperado, por seguridad, tratar como si fuera tier alto
          // Esto es un WARN porque Tier es un enum y esto no debería pasar si los datos son consistentes.
          console.warn(`⚠️ Tier inesperado para la primera tarea de prioridad HIGH: ${firstTaskTier}. Se asumirá tier alto y se insertará al inicio.`)
          insertAt = 0
          calculatedStartDate = await getNextAvailableStart(new Date())
          affectedTasks.push(...userSlot.tasks)
        }
      } else { // No hay tareas en la cola, por lo tanto, es la primera tarea
        insertAt = 0
        calculatedStartDate = await getNextAvailableStart(new Date())
      }
      break

    case 'NORMAL':
      return await calculateNormalPriorityPosition(userSlot)

    case 'LOW':
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate // Las tareas LOW comienzan cuando el usuario está disponible después de todas las tareas actuales
      break

    default:
      // No debería alcanzarse si todas las prioridades están manejadas, pero como salvaguarda
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate
  }

  console.log(`✅ Resultado: insertAt=${insertAt}, fecha=${calculatedStartDate.toISOString()}`)
  // Añadir log para las tareas afectadas
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

      if (normalTasksBeforeThisLow < 5) {
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

// Esta función ya no se usa directamente desde processUserAssignments,
// en su lugar, se llama a shiftUserTasks directamente desde processUserAssignments
// con los datos de queueResult.affectedTasks.
export async function updateAffectedTasksPositions(
  userId: string,
  insertAt: number,
  affectedTasks: Task[]
): Promise<void> {
  // Esta función ahora es un wrapper para shiftUserTasks para mantener la compatibilidad
  // y la claridad de la llamada.
  await shiftUserTasks(userId, 'NEW_TASK_PLACEHOLDER', new Date(), insertAt); // new Date() y 'NEW_TASK_PLACEHOLDER' son placeholders aquí
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

    // Aquí es donde se llama a shiftUserTasks para reacomodar las tareas
    // Se pasa la nueva tarea como 'newTaskId' con un placeholder,
    // y la fecha de finalización de la nueva tarea como 'newDeadline'
    // y la posición de inserción de la nueva tarea como 'startPosition'
    if (queueResult.affectedTasks.length > 0) {
      console.log(`🔄 Preparando para reacomodar ${queueResult.affectedTasks.length} tareas para el usuario ${userSlot.userName}.`)
      // La clave aquí es que shiftUserTasks necesita el ID de la *nueva* tarea
      // para excluirla de la consulta inicial. Como aún no se ha creado en la DB,
      // pasamos un placeholder temporal y la lógica de filtrado en shiftUserTasks
      // debe manejar esto o ajustarse para que no excluya la nueva tarea si aún no existe.
      // Por ahora, asumimos que la nueva tarea se insertará *después* de este cálculo.
      // La función shiftUserTasks ya filtra por `id: { not: newTaskId }`
      // Entonces, la nueva tarea no estará en la lista de tareas a desplazar.
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