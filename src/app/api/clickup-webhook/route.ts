/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/clickup-webhook/route.ts - VERSIÓN COMPLETA CON MANEJO DE UPDATES
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN
const WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET // Opcional para seguridad

// ✅ NUEVO: Tipos para eventos de ClickUp
interface ClickUpWebhookEvent {
  event: string;
  task_id?: string;
  history_items?: Array<{
    field: string;
    before: any;
    after: any;
  }>;
  task?: {
    id: string;
    name: string;
    description: string;
    status: {
      status: string;
      color: string;
      type: string;
    };
    priority: {
      priority: string;
      color: string;
    };
    assignees: Array<{
      id: number;
      username: string;
      email: string;
    }>;
    due_date: string | null;
    start_date: string | null;
    time_estimate: number | null;
  };
}

// ✅ MANTENER GET EXISTENTE
export async function GET(req: Request) {
  try {
    console.log('📥 GET request to webhook endpoint')
    
    const { searchParams } = new URL(req.url)
    
    // Si ClickUp está verificando el webhook
    const challenge = searchParams.get('challenge')
    if (challenge) {
      console.log('🔐 ClickUp webhook verification challenge received')
      return new Response(challenge, { status: 200 })
    }

    // Tu lógica GET existente para obtener tareas...
    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where: any = {}
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
    console.error('❌ Error in GET handler:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

// ✅ MEJORADO: POST ahora maneja tanto creación como actualizaciones
export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // ✅ LOGGING COMPLETO
    console.log('📥 === CLICKUP WEBHOOK RECEIVED ===')
    console.log('📋 Event type:', body.event)
    console.log('📦 Full payload:', JSON.stringify(body, null, 2))
    
    // ✅ VERIFICACIÓN DE SEGURIDAD (opcional)
    if (WEBHOOK_SECRET) {
      const signature = req.headers.get('x-signature')
      // Aquí implementarías la verificación de firma si ClickUp la proporciona
      // Por ahora, solo loguear
      console.log('🔐 Signature:', signature)
    }

    // ✅ MANEJAR DIFERENTES EVENTOS DE CLICKUP
    const event = body as ClickUpWebhookEvent
    
    switch (event.event) {
      case 'taskUpdated':
        return await handleTaskUpdate(event)
        
      case 'taskCreated':
        return await handleTaskCreated(event)
        
      case 'taskDeleted':
        return await handleTaskDeleted(event)
        
      case 'taskStatusUpdated':
        return await handleTaskStatusUpdate(event)
        
      case 'taskAssigneeUpdated':
        return await handleTaskAssigneeUpdate(event)
        
      default:
        console.log(`⚠️ Unhandled webhook event: ${event.event}`)
        return NextResponse.json({ 
          message: `Event ${event.event} received but not handled` 
        })
    }
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error)
    
    // ✅ IMPORTANTE: Devolver 200 para que ClickUp no reintente
    return NextResponse.json({
      error: 'Error processing webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 }) // ClickUp espera 200 incluso en errores
  }
}

// ✅ HANDLERS PARA DIFERENTES EVENTOS

async function handleTaskUpdate(event: ClickUpWebhookEvent) {
  console.log('📝 Processing task update...')
  
  if (!event.task_id) {
    console.error('❌ No task_id in update event')
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    // Obtener tarea actual de la DB
    const existingTask = await prisma.task.findUnique({
      where: { id: event.task_id },
      include: {
        assignees: true
      }
    })

    // ✅ OPCIONAL: Validar/enriquecer datos con ClickUp API si no existe o datos incompletos
    let enrichedTaskData = event.task
    
    if (!existingTask) {
      console.log(`⚠️ Task ${event.task_id} not found in local DB`)
      
      // ✅ OPCIONAL: Obtener detalles completos de ClickUp si no está en DB local
      if (CLICKUP_TOKEN) {
        try {
          console.log('🔍 Fetching task details from ClickUp API...')
          const clickupResponse = await axios.get(
            `https://api.clickup.com/api/v2/task/${event.task_id}`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          )
          console.log('✅ Task details obtained from ClickUp:', clickupResponse.data.name)
          // Aquí podrías crear la tarea en tu DB si quisieras
        } catch (apiError) {
          console.error('❌ Error fetching from ClickUp API:', apiError)
        }
      }
      
      return NextResponse.json({ message: 'Task not found locally' })
    }
    
    if (CLICKUP_TOKEN && (!event.task || !event.task.name)) {
      try {
        console.log('🔍 Webhook data incomplete, fetching full task from ClickUp...')
        const clickupResponse = await axios.get(
          `https://api.clickup.com/api/v2/task/${event.task_id}`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        )
        
        // Mapear respuesta de ClickUp a nuestro formato
        enrichedTaskData = {
          id: clickupResponse.data.id,
          name: clickupResponse.data.name,
          description: clickupResponse.data.description,
          status: clickupResponse.data.status,
          priority: clickupResponse.data.priority,
          assignees: clickupResponse.data.assignees,
          due_date: clickupResponse.data.due_date,
          start_date: clickupResponse.data.start_date,
          time_estimate: clickupResponse.data.time_estimate
        }
        
        console.log('✅ Task data enriched from ClickUp API')
      } catch (apiError) {
        console.error('⚠️ Could not enrich data from ClickUp:', apiError)
        // Continuar con los datos del webhook
      }
    }

    if (!existingTask) {
      console.log(`⚠️ Task ${event.task_id} not found in local DB`)
      return NextResponse.json({ message: 'Task not found locally' })
    }

    // Preparar datos de actualización
    const updateData: any = {}

    // Actualizar campos si han cambiado
    const taskData = enrichedTaskData || event.task
    if (taskData) {
      if (taskData.name && taskData.name !== existingTask.name) {
        updateData.name = taskData.name
        console.log(`  📝 Name: "${existingTask.name}" → "${taskData.name}"`)
      }

      if (taskData.description !== undefined && taskData.description !== existingTask.description) {
        updateData.description = taskData.description || null
        console.log(`  📝 Description updated`)
      }

      if (taskData.status) {
        const newStatus = mapClickUpStatusToLocal(taskData.status.status)
        if (newStatus !== existingTask.status) {
          updateData.status = newStatus
          console.log(`  📊 Status: ${existingTask.status} → ${newStatus}`)
        }
      }

      if (taskData.priority) {
        const priorityMap: Record<string, Priority> = {
          'urgent': 'URGENT',
          'high': 'HIGH',
          'normal': 'NORMAL',
          'low': 'LOW'
        }
        const newPriority = priorityMap[taskData.priority.priority.toLowerCase()] || 'NORMAL'
        
        if (newPriority !== existingTask.priority) {
          updateData.priority = newPriority
          console.log(`  🔥 Priority: ${existingTask.priority} → ${newPriority}`)
        }
      }

      if (taskData.start_date !== undefined) {
        const newStartDate = taskData.start_date ? new Date(parseInt(taskData.start_date)) : null
        if (newStartDate && newStartDate.getTime() !== existingTask.startDate.getTime()) {
          updateData.startDate = newStartDate
          console.log(`  📅 Start date: ${existingTask.startDate.toISOString()} → ${newStartDate.toISOString()}`)
        }
      }

      if (taskData.due_date !== undefined) {
        const newDeadline = taskData.due_date ? new Date(parseInt(taskData.due_date)) : null
        if (newDeadline && newDeadline.getTime() !== existingTask.deadline.getTime()) {
          updateData.deadline = newDeadline
          console.log(`  📅 Deadline: ${existingTask.deadline.toISOString()} → ${newDeadline.toISOString()}`)
        }
      }

      if (taskData.time_estimate !== undefined) {
        updateData.timeEstimate = taskData.time_estimate
        console.log(`  ⏱️ Time estimate: ${existingTask.timeEstimate} → ${taskData.time_estimate}`)
      }
    }

    // Si hay cambios, actualizar
    if (Object.keys(updateData).length > 0) {
      updateData.lastSyncAt = new Date()
      updateData.syncStatus = 'SYNCED'

      const updatedTask = await prisma.task.update({
        where: { id: event.task_id },
        data: updateData,
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

      console.log(`✅ Task ${event.task_id} updated successfully`)
      console.log(`  Changed fields: ${Object.keys(updateData).join(', ')}`)

      // Emitir evento Socket.IO
      try {
        await axios.post('https://task-automation-zeta.vercel.app/api/socket_emitter', {
          eventName: 'task_update',
          data: updatedTask,
        })
        console.log('✅ Socket event emitted')
      } catch (emitterError) {
        console.error('⚠️ Error emitting socket event:', emitterError)
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Task updated',
        taskId: event.task_id,
        updatedFields: Object.keys(updateData)
      })
    } else {
      console.log('ℹ️ No changes detected')
      return NextResponse.json({ 
        success: true, 
        message: 'No changes needed',
        taskId: event.task_id
      })
    }

  } catch (error) {
    console.error('❌ Error updating task:', error)
    return NextResponse.json({ 
      error: 'Error updating task',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTaskCreated(event: ClickUpWebhookEvent) {
  console.log('➕ Processing task creation...')
  
  // Aquí podrías sincronizar la nueva tarea si fue creada directamente en ClickUp
  // Por ahora, solo loguear
  console.log('  Task ID:', event.task_id)
  console.log('  Task Name:', event.task?.name)
  
  return NextResponse.json({ 
    message: 'Task creation noted',
    taskId: event.task_id
  })
}

async function handleTaskDeleted(event: ClickUpWebhookEvent) {
  console.log('🗑️ Processing task deletion...')
  
  if (!event.task_id) {
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    // Soft delete o hard delete según tu preferencia
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: 'COMPLETE',
        syncStatus: 'DELETED',
        lastSyncAt: new Date()
      }
    })

    console.log(`✅ Task ${event.task_id} marked as deleted`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Task marked as deleted',
      taskId: event.task_id
    })
  } catch (error) {
    console.error('❌ Error deleting task:', error)
    return NextResponse.json({ 
      error: 'Error deleting task',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTaskStatusUpdate(event: ClickUpWebhookEvent) {
  console.log('📊 Processing status update...')
  
  if (!event.task_id || !event.task?.status) {
    return NextResponse.json({ error: 'Missing required data' })
  }

  try {
    const newStatus = mapClickUpStatusToLocal(event.task.status.status)
    
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: newStatus,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED'
      }
    })

    console.log(`✅ Task ${event.task_id} status updated to ${newStatus}`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Status updated',
      taskId: event.task_id,
      newStatus
    })
  } catch (error) {
    console.error('❌ Error updating status:', error)
    return NextResponse.json({ 
      error: 'Error updating status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleTaskAssigneeUpdate(event: ClickUpWebhookEvent) {
  console.log('👥 Processing assignee update...')
  
  if (!event.task_id || !event.task?.assignees) {
    return NextResponse.json({ error: 'Missing required data' })
  }

  try {
    // Eliminar asignaciones existentes
    await prisma.taskAssignment.deleteMany({
      where: { taskId: event.task_id }
    })

    // Crear nuevas asignaciones
    const newAssignments = []
    for (const assignee of event.task.assignees) {
      const user = await prisma.user.findUnique({
        where: { id: assignee.id.toString() }
      })

      if (user) {
        newAssignments.push({
          userId: user.id,
          taskId: event.task_id
        })
      }
    }

    if (newAssignments.length > 0) {
      await prisma.taskAssignment.createMany({
        data: newAssignments
      })
    }

    console.log(`✅ Task ${event.task_id} assignees updated (${newAssignments.length} assignees)`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Assignees updated',
      taskId: event.task_id,
      assigneeCount: newAssignments.length
    })
  } catch (error) {
    console.error('❌ Error updating assignees:', error)
    return NextResponse.json({ 
      error: 'Error updating assignees',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}