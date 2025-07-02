// services/task-assignment.service.ts - VERSIÓN CONSERVADORA

import { prisma, isPostgreSQL, createUniqueTimestamp, getDatabaseTimestamp } from '@/utils/prisma'
import { Priority, Status } from '@prisma/client'
import { UserSlot, UserWithRoles, Task, QueueCalculationResult, TaskTimingResult } from '@/interfaces'
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils'

const GENERALIST_CONSIDERATION_THRESHOLD = 3

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
    if (tasks.length > 0) {
      const lastTask = tasks[tasks.length - 1]
      availableDate = await getNextAvailableStart(new Date(lastTask.deadline))
    } else {
      if (isPostgreSQL()) {
        try {
          const dbNow = await getDatabaseTimestamp()
          availableDate = createUniqueTimestamp(dbNow)
          availableDate = await getNextAvailableStart(availableDate)
        } catch (error) {
          console.warn('⚠️ Error con timestamp de DB, usando local:', error)
          availableDate = await getNextAvailableStart(new Date())
        }
      } else {
        availableDate = await getNextAvailableStart(new Date())
      }
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
    }
  }))
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

  let bestSlot: UserSlot | null = null

  if (specialists.length > 0) {
    const sortedSpecialists = sortUsers(specialists)
    bestSlot = sortedSpecialists[0]
    console.log(`Asignación: Especialista preferido encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`)
  }

  if (!bestSlot || bestSlot.cargaTotal >= GENERALIST_CONSIDERATION_THRESHOLD) {
    if (generalists.length > 0) {
      const sortedGeneralists = sortUsers(generalists)
      const bestGeneralist = sortedGeneralists[0]

      if (bestSlot) {
        const shouldUseGeneralist = bestGeneralist.cargaTotal < bestSlot.cargaTotal ||
          bestGeneralist.availableDate.getTime() < bestSlot.availableDate.getTime() - (2 * 24 * 60 * 60 * 1000)

        if (shouldUseGeneralist) {
          bestSlot = bestGeneralist
          console.log(`Asignación: Generalista ${bestSlot.userName} elegido sobre especialista por menor carga/disponibilidad.`)
        } else {
          console.log(`Asignación: Especialista ${bestSlot.userName} mantenido, generalista no es significativamente mejor.`)
        }
      } else {
        bestSlot = bestGeneralist
        console.log(`Asignación: No hay especialistas, mejor generalista encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`)
      }
    }
  }

  return bestSlot
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
      if (userSlot.tasks.length > 0) {
        calculatedStartDate = isPostgreSQL() ? 
          createUniqueTimestamp(userSlot.availableDate) : 
          userSlot.availableDate
      } else {
        calculatedStartDate = isPostgreSQL() ? 
          createUniqueTimestamp(await getNextAvailableStart(new Date())) : 
          await getNextAvailableStart(new Date())
      }
      affectedTasks.push(...userSlot.tasks)
      break

    case 'HIGH':
      if (userSlot.tasks.length >= 1) {
        const firstTask = userSlot.tasks[0]
        const firstTaskTier = firstTask.category?.tier

        if (firstTaskTier && ['E', 'D'].includes(firstTaskTier)) {
          insertAt = 1
          calculatedStartDate = await getNextAvailableStart(new Date(firstTask.deadline))
          if (isPostgreSQL()) {
            calculatedStartDate = createUniqueTimestamp(calculatedStartDate)
          }
          affectedTasks.push(...userSlot.tasks.slice(1))
        } else if (firstTaskTier && ['C', 'B', 'A', 'S'].includes(firstTaskTier)) {
          insertAt = 0
          if (userSlot.tasks.length > 0) {
            calculatedStartDate = isPostgreSQL() ? 
              createUniqueTimestamp(userSlot.availableDate) : 
              userSlot.availableDate
          } else {
            calculatedStartDate = await getNextAvailableStart(new Date())
            if (isPostgreSQL()) {
              calculatedStartDate = createUniqueTimestamp(calculatedStartDate)
            }
          }
          affectedTasks.push(...userSlot.tasks)
        } else {
          return await calculateNormalPriorityPosition(userSlot)
        }
      } else {
        insertAt = 0
        calculatedStartDate = await getNextAvailableStart(new Date())
        if (isPostgreSQL()) {
          calculatedStartDate = createUniqueTimestamp(calculatedStartDate)
        }
      }
      break

    case 'NORMAL':
      return await calculateNormalPriorityPosition(userSlot)

    case 'LOW':
      insertAt = userSlot.tasks.length
      calculatedStartDate = isPostgreSQL() ? 
        createUniqueTimestamp(userSlot.availableDate) : 
        userSlot.availableDate
      break

    default:
      insertAt = userSlot.tasks.length
      calculatedStartDate = userSlot.availableDate
  }

  console.log(`✅ Resultado: insertAt=${insertAt}, fecha=${calculatedStartDate.toISOString()}`)

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
    if (userSlot.tasks.length > 0) {
      calculatedStartDate = isPostgreSQL() ? 
        createUniqueTimestamp(userSlot.availableDate) : 
        userSlot.availableDate
    } else {
      calculatedStartDate = await getNextAvailableStart(new Date())
      if (isPostgreSQL()) {
        calculatedStartDate = createUniqueTimestamp(calculatedStartDate)
      }
    }
  } else {
    const prevTask = userSlot.tasks[insertAt - 1]
    calculatedStartDate = await getNextAvailableStart(new Date(prevTask.deadline))
    if (isPostgreSQL()) {
      calculatedStartDate = createUniqueTimestamp(calculatedStartDate)
    }
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
  for (let i = 0; i < affectedTasks.length; i++) {
    const task = affectedTasks[i]
    const newPosition = insertAt + i + 1

    await prisma.task.update({
      where: { id: task.id },
      data: { queuePosition: newPosition }
    })
  }

  console.log(`✅ Actualizadas ${affectedTasks.length} posiciones de tareas para usuario ${userId}`)
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
      await updateAffectedTasksPositions(userId, queueResult.insertAt, queueResult.affectedTasks)
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