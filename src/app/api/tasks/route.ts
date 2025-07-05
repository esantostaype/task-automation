// src/app/api/tasks/route.ts - VERSIÓN FINAL CON LÓGICA DE VACACIONES

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

/**
 * GET /api/tasks
 * Obtiene tareas con filtros y paginación
 * Query params: ?brandId=X&status=Y&priority=Z&page=1&limit=10
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Construir filtros
    const where: TaskWhereInput = {}
    if (brandId) where.brandId = brandId
    if (status && Object.values(Status).includes(status as Status)) {
      where.status = status as Status
    }
    if (priority && Object.values(Priority).includes(priority as Priority)) {
      where.priority = priority as Priority
    }

    // Obtener tareas con relaciones
    const tasks = await prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: 'asc' },
      include: {
        category: {
          include: {
            type: true
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

    // Contar total para paginación
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
        queuePosition: task.queuePosition,
        lastSyncAt: task.lastSyncAt?.toISOString(),
        syncStatus: task.syncStatus,
        syncError: task.syncError,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        category: {
          id: task.category.id,
          name: task.category.name,
          duration: task.category.duration,
          tier: task.category.tier,
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

/**
 * POST /api/tasks
 * Crea una nueva tarea con lógica de vacaciones
 * Body: { name, description?, typeId, categoryId, priority, brandId, assignedUserIds?, durationDays }
 */
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

    // Validar campos requeridos
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

    // Obtener categoría y brand
    const [category, brand] = await Promise.all([
      prisma.taskCategory.findUnique({
        where: { id: categoryId },
        include: { type: true }
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
      // ===== ASIGNACIÓN MANUAL =====
      usersToAssign = assignedUserIds
      console.log('👤 Asignación manual de usuarios:', usersToAssign)

      // Validar usuarios especificados
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

      // Actualizar lista con usuarios válidos
      usersToAssign = validUsers.map(user => user.id)
      console.log(`✅ Usuarios válidos para asignación manual: ${usersToAssign.length}`)

      // Calcular slots para usuarios manuales (sin lógica de vacaciones específica)
      userSlotsForProcessing = await calculateUserSlots(validUsers, typeId, brandId)

    } else {
      // ===== ASIGNACIÓN AUTOMÁTICA CON LÓGICA DE VACACIONES =====
      console.log('🤖 Iniciando asignación automática con lógica de vacaciones...')

      // Usar función con cache que incluye lógica de vacaciones
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

    // ===== DEBUG: ESTADO ANTES DE ASIGNAR =====
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

    // ===== PROCESAR ASIGNACIONES Y CALCULAR FECHAS =====
    const taskTiming = await processUserAssignments(usersToAssign, userSlotsForProcessing, priority, durationDays)

    console.log('✅ Fechas calculadas para nueva tarea:')
    console.log(`   - Start Date: ${taskTiming.startDate.toISOString()}`)
    console.log(`   - Deadline: ${taskTiming.deadline.toISOString()}`)
    console.log(`   - Queue Position: ${taskTiming.insertAt}`)

    // ===== PREPARAR DATOS PARA CLICKUP =====
    const categoryForClickUp = {
      ...category,
      type: {
        ...category.type,
        categories: []
      }
    }

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? '',
      statusMapping: (brand.statusMapping as Record<string, string>) || {}
    }

    // ===== CREAR TAREA EN CLICKUP =====
    console.log('📤 Creando tarea en ClickUp...')
    const { clickupTaskId, clickupTaskUrl } = await createTaskInClickUp({
      name,
      description,
      priority,
      deadline: taskTiming.deadline,
      startDate: taskTiming.startDate,
      usersToAssign,
      category: categoryForClickUp,
      brand: brandForClickUp
    })

    console.log(`✅ Tarea creada en ClickUp: ${clickupTaskId}`)

    // ===== GUARDAR EN BASE DE DATOS LOCAL =====
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
        queuePosition: taskTiming.insertAt,
        url: clickupTaskUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
      },
      include: {
        category: {
          include: {
            type: true
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

    // ===== CREAR ASIGNACIONES =====
    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    })

    console.log(`✅ Asignaciones creadas para ${usersToAssign.length} usuarios`)

    // ===== RECALCULAR FECHAS DE TAREAS EXISTENTES =====
    console.log('🔄 Iniciando recálculo de fechas de tareas existentes...')
    for (const userId of usersToAssign) {
      try {
        await shiftUserTasks(userId, task.id, taskTiming.deadline, taskTiming.insertAt)
        console.log(`✅ Fechas recalculadas para usuario ${userId}`)
      } catch (shiftError) {
        console.error(`❌ Error recalculando fechas para usuario ${userId}:`, shiftError)
      }
    }

    // ===== OBTENER TAREA COMPLETA CON ASIGNACIONES =====
    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        category: {
          include: {
            type: true
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

    // ===== DEBUG: ESTADO DESPUÉS DE CREAR TAREA =====
    console.log('🔍 DEBUG - Estado DESPUÉS de crear tarea:')
    for (const userId of usersToAssign) {
      const userTasks = await prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: ['COMPLETE'] }
        },
        orderBy: { queuePosition: 'asc' },
        include: { category: true }
      })

      console.log(`  👤 Usuario ${userId} ahora tiene ${userTasks.length} tareas:`)
      userTasks.forEach((t, i) => {
        console.log(`    ${i + 1}. [${t.queuePosition}] "${t.name}": ${t.startDate.toISOString()} → ${t.deadline.toISOString()}`)
      })
    }

    // ===== EMITIR EVENTO WEBSOCKET =====
    try {
      await axios.post(API_CONFIG.SOCKET_EMITTER_URL, {
        eventName: 'task_update',
        data: taskWithAssignees,
      })
      console.log('✅ Evento task_update enviado al socket-emitter.')
    } catch (emitterError) {
      console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
    }

    // ===== INVALIDAR CACHE =====
    invalidateAllCache()
    console.log('🗑️ Cache invalidado después de crear tarea')

    console.log(`🎉 === TAREA "${name}" CREADA EXITOSAMENTE ===`)

    // ===== RESPUESTA FINAL =====
    return NextResponse.json({
      id: taskWithAssignees?.id,
      name: taskWithAssignees?.name,
      description: taskWithAssignees?.description,
      status: taskWithAssignees?.status,
      priority: taskWithAssignees?.priority,
      startDate: taskWithAssignees?.startDate.toISOString(),
      deadline: taskWithAssignees?.deadline.toISOString(),
      url: taskWithAssignees?.url,
      queuePosition: taskWithAssignees?.queuePosition,
      createdAt: taskWithAssignees?.createdAt.toISOString(),
      category: {
        id: taskWithAssignees?.category.id,
        name: taskWithAssignees?.category.name,
        duration: taskWithAssignees?.category.duration,
        tier: taskWithAssignees?.category.tier,
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