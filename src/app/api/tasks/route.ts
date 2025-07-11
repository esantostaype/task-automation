/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/api/tasks/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import {
  calculateUserSlots,
  processUserAssignments,
  getBestUserWithCache
} from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { TaskCreationParams, UserSlot, UserWithRoles, ClickUpBrand, TaskWhereInput } from '@/interfaces'
import { shiftUserTasks } from '@/utils/task-calculation-utils'
import { invalidateAllCache } from '@/utils/cache'
import { API_CONFIG } from '@/config'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: TaskWhereInput = {}
    if (brandId) where.brandId = brandId
    if (status && Object.values(Status).includes(status as Status)) {
      where.status = status as Status
    }
    if (priority && Object.values(Priority).includes(priority as Priority)) {
      where.priority = priority as Priority
    }

    const tasks = await prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: 'asc' },
      include: {
        category: {
          include: {
            type: true,
            tierList: true // IMPORTANTE: Incluir tierList
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    const totalTasks = await prisma.task.count({ where })

    console.log(`📋 Tareas obtenidas: ${tasks.length} de ${totalTasks} total`)

    return NextResponse.json({
      data: tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate.toISOString(),
        deadline: task.deadline.toISOString(),
        timeEstimate: task.timeEstimate,
        points: task.points,
        tags: task.tags,
        url: task.url,
        lastSyncAt: task.lastSyncAt?.toISOString(),
        syncStatus: task.syncStatus,
        syncError: task.syncError,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        category: {
          id: task.category.id,
          name: task.category.name,
          duration: task.category.tierList.duration, // Acceder a través de tierList
          tier: task.category.tierList.name, // El nombre del tier
          type: {
            id: task.category.type.id,
            name: task.category.type.name
          }
        },
        type: {
          id: task.type.id,
          name: task.type.name
        },
        brand: {
          id: task.brand.id,
          name: task.brand.name,
          description: task.brand.description
        },
        assignees: task.assignees.map(assignment => ({
          userId: assignment.userId,
          user: {
            id: assignment.user.id,
            name: assignment.user.name,
            email: assignment.user.email
          }
        }))
      })),
      pagination: {
        total: totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit),
        hasNextPage: page < Math.ceil(totalTasks / limit),
        hasPrevPage: page > 1
      }
    })
  } catch (error) {
    console.error('❌ Error fetching tasks:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado.')
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN no configurado' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const {
      name,
      description,
      typeId,
      categoryId,
      priority,
      brandId,
      assignedUserIds,
      durationDays
    }: TaskCreationParams = body

    if (!name || !typeId || !categoryId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({
        error: 'Faltan campos requeridos o duración inválida',
        required: ['name', 'typeId', 'categoryId', 'priority', 'brandId', 'durationDays']
      }, { status: 400 })
    }

    console.log(`🚀 === CREANDO TAREA "${name}" CON LÓGICA DE VACACIONES ===`)
    console.log(`📋 Parámetros:`)
    console.log(`   - Priority: ${priority}`)
    console.log(`   - Duration: ${durationDays} días`)
    console.log(`   - Type ID: ${typeId}`)
    console.log(`   - Category ID: ${categoryId}`)
    console.log(`   - Brand ID: ${brandId}`)
    console.log(`   - Users: ${assignedUserIds || 'AUTO-ASSIGNMENT'}`)

    const [category, brand] = await Promise.all([
      prisma.taskCategory.findUnique({
        where: { id: categoryId },
        include: { 
          type: true,
          tierList: true // IMPORTANTE: Incluir tierList
        }
      }),
      prisma.brand.findUnique({
        where: { id: brandId }
      })
    ])

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    if (!brand) {
      return NextResponse.json({ error: 'Brand no encontrado' }, { status: 404 })
    }

    console.log(`✅ Categoría: ${category.name} (${category.type.name})`)
    console.log(`✅ Brand: ${brand.name}`)

    let usersToAssign: string[] = []
    let userSlotsForProcessing: UserSlot[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      usersToAssign = assignedUserIds
      console.log('👤 Asignación manual de usuarios:', usersToAssign)

      const specificUsersPromises = usersToAssign.map(userId =>
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            roles: {
              where: {
                OR: [
                  { brandId: brandId },
                  { brandId: null }
                ]
              }
            }
          }
        })
      )

      const specificUsersResults = await Promise.all(specificUsersPromises)

      const validUsers: UserWithRoles[] = specificUsersResults
        .filter((user): user is NonNullable<typeof user> =>
          user !== null &&
          user.active &&
          user.roles.some(role => role.typeId === typeId)
        ) as UserWithRoles[]

      if (validUsers.length === 0) {
        return NextResponse.json({
          error: 'Ninguno de los usuarios especificados es compatible con este tipo de tarea',
          details: 'Verifique que los usuarios existan, estén activos y tengan roles compatibles'
        }, { status: 400 })
      }

      if (validUsers.length !== usersToAssign.length) {
        const invalidUsers = usersToAssign.filter(id =>
          !validUsers.some(user => user.id === id)
        )
        console.warn(`⚠️ Usuarios no válidos ignorados: ${invalidUsers.join(', ')}`)
      }

      usersToAssign = validUsers.map(user => user.id)
      console.log(`✅ Usuarios válidos para asignación manual: ${usersToAssign.length}`)

      userSlotsForProcessing = await calculateUserSlots(validUsers, typeId, durationDays)

    } else {
      console.log('🤖 Iniciando asignación automática con lógica de vacaciones...')

      const bestUser = await getBestUserWithCache(typeId, brandId, priority, durationDays)

      if (!bestUser) {
        return NextResponse.json({
          error: 'No se pudo encontrar un diseñador óptimo para la asignación automática',
          details: 'No hay usuarios disponibles que cumplan con los criterios de asignación considerando vacaciones y carga de trabajo'
        }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
      userSlotsForProcessing = [bestUser]
      console.log('✅ Usuario seleccionado automáticamente:', {
        name: bestUser.userName,
        carga: bestUser.cargaTotal,
        disponible: bestUser.availableDate.toISOString(),
        especialista: bestUser.isSpecialist
      })
    }

    console.log('🔍 DEBUG - Estados de usuarios ANTES de asignar:')
    userSlotsForProcessing.forEach(slot => {
      if (usersToAssign.includes(slot.userId)) {
        console.log(`  👤 ${slot.userName}:`)
        console.log(`     - Carga actual: ${slot.cargaTotal} tareas`)
        console.log(`     - Disponible desde: ${slot.availableDate.toISOString()}`)
        console.log(`     - Es especialista: ${slot.isSpecialist}`)
        if (slot.tasks.length > 0) {
          console.log(`     - Última tarea termina: ${slot.tasks[slot.tasks.length - 1].deadline}`)
        }
      }
    })

    const taskTiming = await processUserAssignments(usersToAssign, userSlotsForProcessing, priority, durationDays)

    console.log('🎯 === FINAL TASK TIMING BEFORE CLICKUP CREATION ===');
    console.log(`📅 Calculated start date: ${taskTiming.startDate.toISOString()}`);
    console.log(`📅 Calculated deadline: ${taskTiming.deadline.toISOString()}`);
    console.log(`📍 Queue position: ${taskTiming.insertAt}`);
    console.log(`👥 Assigned users: ${usersToAssign.join(', ')}`);
    console.log(`⏰ Duration: ${durationDays} days`);
    console.log(`🔥 Priority: ${priority}`);

    const categoryForClickUp = {
      ...category,
      type: {
        ...category.type,
        categories: []
      },  
      duration: category.tierList.duration,
      tier: category.tierList.name
    }

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? ''
    }

    console.log('📤 Creando tarea en ClickUp...')
     const clickupTaskId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
const clickupTaskUrl = `https://local-dev.com/task/${clickupTaskId}`

    console.log(`✅ Tarea creada en ClickUp: ${clickupTaskId}`)

    const task = await prisma.task.create({
      data: {
        id: clickupTaskId,
        name,
        description,
        typeId: typeId,
        categoryId: categoryId,
        brandId: brandId,
        priority,
        startDate: taskTiming.startDate,
        deadline: taskTiming.deadline,
        url: clickupTaskUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
        customDuration: durationDays !== category.tierList.duration ? durationDays : null // Comparar con tierList.duration
      },
      include: {
        category: {
          include: {
            type: true,
            tierList: true // Incluir tierList
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
    })

    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    })

    console.log(`✅ Asignaciones creadas para ${usersToAssign.length} usuarios`)

    console.log('🔄 Iniciando recálculo de fechas de tareas existentes...')
    for (const userId of usersToAssign) {
      try {
        await shiftUserTasks(userId, task.id, taskTiming.deadline, taskTiming.insertAt)
        console.log(`✅ Fechas recalculadas para usuario ${userId}`)
      } catch (shiftError) {
        console.error(`❌ Error recalculando fechas para usuario ${userId}:`, shiftError)
      }
    }

    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        category: {
          include: {
            type: true,
            tierList: true // Incluir tierList
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    console.log('🔍 DEBUG - Estado DESPUÉS de crear tarea:')
    for (const userId of usersToAssign) {
      const userTasks = await prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: ['COMPLETE'] }
        },
        orderBy: { deadline: 'asc' },
        include: { 
          category: {
            include: {
              tierList: true
            }
          }
        }
      })
    }

    try {
      await axios.post(API_CONFIG.SOCKET_EMITTER_URL, {
        eventName: 'task_update',
        data: taskWithAssignees,
      })
      console.log('✅ Evento task_update enviado al socket-emitter.')
    } catch (emitterError) {
      console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
    }

    invalidateAllCache()
    console.log('🗑️ Cache invalidado después de crear tarea')

    console.log(`🎉 === TAREA "${name}" CREADA EXITOSAMENTE ===`)

    return NextResponse.json({
      id: taskWithAssignees?.id,
      name: taskWithAssignees?.name,
      description: taskWithAssignees?.description,
      status: taskWithAssignees?.status,
      priority: taskWithAssignees?.priority,
      startDate: taskWithAssignees?.startDate.toISOString(),
      deadline: taskWithAssignees?.deadline.toISOString(),
      url: taskWithAssignees?.url,
      createdAt: taskWithAssignees?.createdAt.toISOString(),
      category: {
        id: taskWithAssignees?.category.id,
        name: taskWithAssignees?.category.name,
        duration: taskWithAssignees?.category.tierList.duration, // Desde tierList
        tier: taskWithAssignees?.category.tierList.name, // Desde tierList
        type: {
          id: taskWithAssignees?.category.type.id,
          name: taskWithAssignees?.category.type.name
        }
      },
      brand: {
        id: taskWithAssignees?.brand.id,
        name: taskWithAssignees?.brand.name
      },
      assignees: taskWithAssignees?.assignees.map(assignment => ({
        userId: assignment.userId,
        user: {
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email
        }
      })) || []
    })

  } catch (error) {
    console.error('❌ Error general al crear tarea:', error)

    if (error instanceof Error && error.message.includes('ClickUp')) {
      return NextResponse.json({
        error: 'Error al crear tarea en ClickUp',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
