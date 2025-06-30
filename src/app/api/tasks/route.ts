import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import { calculateUserSlots, findCompatibleUsers, processUserAssignments, selectBestUser } from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { TaskCreationParams, UserSlot, UserWithRoles, ClickUpBrand, TaskWhereInput } from '@/interfaces'

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
        category: true,
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
    console.error('ERROR: CLICKUP_API_TOKEN no configurado.');
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN no configurado' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { name, description, typeId, categoryId, priority, brandId, assignedUserIds, durationDays }: TaskCreationParams = body

    if (!name || !typeId || !categoryId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({ error: 'Faltan campos requeridos o duración inválida' }, { status: 400 })
    }

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

    let usersToAssign: string[] = []
    let userSlots: UserSlot[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      usersToAssign = assignedUserIds;
      console.log('✅ Asignación manual de usuarios:', usersToAssign);

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
        return NextResponse.json({ error: 'Ninguno de los usuarios especificados es compatible con este tipo de tarea' }, { status: 400 })
      }

      userSlots = await calculateUserSlots(validUsers, typeId, brandId)
    } else {
      console.log('🤖 Iniciando asignación automática...')
      
      const compatibleUsers = await findCompatibleUsers(typeId, brandId)
      
      if (compatibleUsers.length === 0) {
        return NextResponse.json({ error: 'No hay usuarios compatibles disponibles para asignación automática' }, { status: 400 })
      }

      userSlots = await calculateUserSlots(compatibleUsers, typeId, brandId)
      const bestUser = selectBestUser(userSlots)

      if (!bestUser) {
        return NextResponse.json({ error: 'No se pudo encontrar un diseñador óptimo para la asignación automática.' }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
      console.log('✅ Usuario seleccionado automáticamente:', bestUser.userName)
    }

    const taskTiming = await processUserAssignments(usersToAssign, userSlots, priority, durationDays);

    console.log('✅ Creando tarea con los siguientes parámetros:', {
      name,
      categoryDuration: category.duration,
      userProvidedDurationDays: durationDays,
      adjustedHours: (durationDays / usersToAssign.length) * 8,
      startDate: taskTiming.startDate.toISOString(),
      deadline: taskTiming.deadline.toISOString(),
      assignedUsers: usersToAssign,
      insertAt: taskTiming.insertAt
    })

    const categoryForClickUp = {
      ...category,
      type: {
        ...category.type,
        categories: []
      }
    }

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      statusMapping: (brand.statusMapping as Record<string, string>) || {}
    }

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
        category: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      },
    });

    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    });

    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        category: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      }
    })

    try {
      await axios.post('https://task-automation-zeta.vercel.app/api/socket_emitter', {
        eventName: 'task_update',
        data: taskWithAssignees,
      })
      console.log('✅ Evento task_update enviado al socket-emitter.');
    } catch (emitterError) {
      console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
    }

    return NextResponse.json(taskWithAssignees);

  } catch (error) {
    console.error('❌ Error general al crear tarea:', error);
    
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