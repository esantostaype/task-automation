// src/app/api/clickup-webhook/route.ts - VERSIÓN CORREGIDA SIN queuePosition
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import { 
  calculateUserSlots, 
  findCompatibleUsers, 
  processUserAssignments, 
  selectBestUser 
} from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { 
  TaskCreationParams, 
  UserSlot, 
  UserWithRoles, 
  ClickUpBrand, 
  TaskWhereInput 
} from '@/interfaces'
import { calculateParallelPriorityInsertion } from '@/services/parallel-priority-insertion.service'

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
      orderBy: { startDate: 'asc' }, // ✅ Ordenar por fecha, no por queuePosition
      include: {
        category: {
          include: {
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: { include: { user: true } }
      }
    })

    const totalTasks = await prisma.task.count({ where })

    return NextResponse.json({
      data: tasks,
      pagination: {
        total: totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tasks:', error)
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

    // Validación de campos requeridos
    if (!name || !typeId || !categoryId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({ 
        error: 'Faltan campos requeridos o duración inválida',
        required: ['name', 'typeId', 'categoryId', 'priority', 'brandId', 'durationDays']
      }, { status: 400 })
    }

    console.log(`🚀 === CREANDO TAREA "${name}" (WEBHOOK) ===`)
    console.log(`📋 Parámetros: Priority=${priority}, Duration=${durationDays}d, Users=${assignedUserIds || 'AUTO'}`)

    // Obtener categoría y brand
    const [category, brand] = await Promise.all([
      prisma.taskCategory.findUnique({
        where: { id: categoryId },
        include: { 
          type: true,
          tierList: true // ✅ Incluir tierList para tener la duración
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

    let usersToAssign: string[] = []
    let userSlots: UserSlot[] = []

    // Manejo de asignación de usuarios (manual o automática)
    if (assignedUserIds && assignedUserIds.length > 0) {
      // ASIGNACIÓN MANUAL
      usersToAssign = assignedUserIds
      console.log('✅ Asignación manual de usuarios:', usersToAssign)

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
          error: 'Ninguno de los usuarios especificados es compatible con este tipo de tarea' 
        }, { status: 400 })
      }

      userSlots = await calculateUserSlots(validUsers, typeId, durationDays, brandId)
      
    } else {
      // ASIGNACIÓN AUTOMÁTICA
      console.log('🤖 Iniciando asignación automática...')
      
      const compatibleUsers = await findCompatibleUsers(typeId, brandId)
      
      if (compatibleUsers.length === 0) {
        return NextResponse.json({ 
          error: 'No hay usuarios compatibles disponibles para asignación automática' 
        }, { status: 400 })
      }

      userSlots = await calculateUserSlots(compatibleUsers, typeId, durationDays, brandId)
      const bestUser = selectBestUser(userSlots)

      if (!bestUser) {
        return NextResponse.json({ 
          error: 'No se pudo encontrar un diseñador óptimo para la asignación automática.' 
        }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
      console.log('✅ Usuario seleccionado automáticamente:', bestUser.userName)
    }

    console.log('🔍 DEBUG - Estados de usuarios ANTES de asignar:')
    userSlots.forEach(slot => {
      if (usersToAssign.includes(slot.userId)) {
        console.log(`  👤 ${slot.userName}: ${slot.cargaTotal} tareas, disponible: ${slot.availableDate.toISOString()}`)
        if (slot.tasks.length > 0) {
          console.log(`    📋 Última tarea termina: ${slot.tasks[slot.tasks.length - 1].deadline}`)
        }
      }
    })

    // ✅ NUEVO: Usar el servicio de inserción paralela con prioridades
    let taskStartDate: Date
    let taskDeadline: Date

    if (usersToAssign.length === 1) {
      // Un solo usuario: usar lógica de prioridad paralela
      const insertionResult = await calculateParallelPriorityInsertion(
        usersToAssign[0],
        priority,
        durationDays
      )
      
      taskStartDate = insertionResult.startDate
      taskDeadline = insertionResult.deadline
      
      console.log('✅ Fechas calculadas con prioridad paralela:', {
        startDate: taskStartDate.toISOString(),
        deadline: taskDeadline.toISOString(),
        reason: insertionResult.insertionReason
      })

      // ✅ Si hay tareas LOW que mover (solo para NORMAL)
      if (insertionResult.tasksToMove && insertionResult.tasksToMove.length > 0) {
        console.log(`🔄 Moviendo ${insertionResult.tasksToMove.length} tareas LOW del día...`)
        
        for (const taskToMove of insertionResult.tasksToMove) {
          await prisma.task.update({
            where: { id: taskToMove.taskId },
            data: {
              startDate: taskToMove.newStartDate,
              deadline: taskToMove.newDeadline
            }
          })
          console.log(`   ✅ Tarea ${taskToMove.taskId} movida`)
        }
      }
      
    } else {
      // Múltiples usuarios: usar lógica existente
      const taskTiming = await processUserAssignments(
        usersToAssign, 
        userSlots, 
        priority, 
        durationDays,
        brandId
      )
      
      taskStartDate = taskTiming.startDate
      taskDeadline = taskTiming.deadline
      
      console.log('✅ Fechas calculadas para múltiples usuarios:', {
        startDate: taskStartDate.toISOString(),
        deadline: taskDeadline.toISOString()
      })
    }

    // Preparar datos para ClickUp
    const categoryForClickUp = {
      ...category,
      type: {
        ...category.type,
        categories: []
      }
    }

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? ''
    }

    // Crear tarea en ClickUp
    const { clickupTaskId, clickupTaskUrl } = await createTaskInClickUp({
      name,
      description,
      priority,
      deadline: taskDeadline,
      startDate: taskStartDate,
      usersToAssign,
      category: categoryForClickUp,
      brand: brandForClickUp,
      customDurationDays: durationDays // ✅ Pasar duración custom si es diferente
    })

    // Crear tarea en base de datos local
    const task = await prisma.task.create({
      data: {
        id: clickupTaskId,
        name,
        description,
        typeId: typeId,
        categoryId: categoryId,
        brandId: brandId,
        priority,
        startDate: taskStartDate,
        deadline: taskDeadline,
        customDuration: durationDays, // ✅ Guardar duración custom
        url: clickupTaskUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
        // ✅ NO incluir queuePosition
      },
      include: {
        category: {
          include: {
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      },
    })

    // Crear asignaciones
    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    })

    // Obtener tarea completa con asignaciones
    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        category: {
          include: {
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      }
    })

    // 🔍 DEBUG: Estado DESPUÉS de crear la tarea
    console.log('🔍 DEBUG - Estado DESPUÉS de crear tarea:')
    for (const userId of usersToAssign) {
      const userTasks = await prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { notIn: ['COMPLETE'] }
        },
        orderBy: { startDate: 'asc' }, // ✅ Ordenar por fecha
        include: { 
          category: {
            include: {
              tierList: true
            }
          }
        }
      })
      
      console.log(`  👤 Usuario ${userId} ahora tiene ${userTasks.length} tareas:`)
      userTasks.forEach((t, i) => {
        const taskDuration = t.customDuration ?? t.category.tierList.duration
        console.log(`    ${i + 1}. "${t.name}" [${t.priority}]: ${t.startDate.toISOString().split('T')[0]} → ${t.deadline.toISOString().split('T')[0]} (${taskDuration}d)`)
      })
    }

    // Emitir evento Socket.IO
    try {
      await axios.post('https://task-automation-zeta.vercel.app/api/socket_emitter', {
        eventName: 'task_update',
        data: taskWithAssignees,
      })
      console.log('✅ Evento task_update enviado al socket-emitter.')
    } catch (emitterError) {
      console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
    }

    console.log(`🎉 === TAREA "${name}" CREADA EXITOSAMENTE VIA WEBHOOK ===\n`)

    return NextResponse.json(taskWithAssignees)

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