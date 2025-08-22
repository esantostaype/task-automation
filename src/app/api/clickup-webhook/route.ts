/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/clickup-webhook/route.ts - VERSIÓN CON LOGS MEJORADOS
import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN
const WEBHOOK_SECRET = process.env.CLICKUP_WEBHOOK_SECRET

// ✅ MEJORADO: Log de entrada más detallado
function logWebhookEntry(req: Request, body: any) {
  const timestamp = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const contentType = req.headers.get('content-type') || 'unknown';
  const signature = req.headers.get('x-signature') || 'no-signature';
  
  console.log('\n🔔 =============== CLICKUP WEBHOOK RECEIVED ===============');
  console.log(`⏰ Timestamp: ${timestamp}`);
  console.log(`🌐 User-Agent: ${userAgent}`);
  console.log(`📝 Content-Type: ${contentType}`);
  console.log(`🔐 Signature: ${signature}`);
  console.log(`📋 Event Type: ${body.event || 'NO_EVENT'}`);
  console.log(`📦 Task ID: ${body.task_id || 'NO_TASK_ID'}`);
  console.log(`📊 Payload Size: ${JSON.stringify(body).length} chars`);
  
  // Log completo del payload para debugging
  console.log(`📦 FULL PAYLOAD:`);
  console.log(JSON.stringify(body, null, 2));
  console.log('========================================================\n');
}

// ✅ MEJORADO: Log de headers del request
function logRequestHeaders(req: Request) {
  console.log('📨 REQUEST HEADERS:');
  req.headers.forEach((value, key) => {
    console.log(`   ${key}: ${value}`);
  });
  console.log('');
}

// ✅ NUEVO: Log de verificación de webhook
function logWebhookVerification(signature: string | null) {
  console.log('🔐 WEBHOOK VERIFICATION:');
  console.log(`   WEBHOOK_SECRET configured: ${WEBHOOK_SECRET ? 'YES' : 'NO'}`);
  console.log(`   Signature received: ${signature ? 'YES' : 'NO'}`);
  console.log(`   Signature value: ${signature || 'none'}`);
  
  if (WEBHOOK_SECRET && signature) {
    // Aquí podrías implementar verificación HMAC si ClickUp la soporta
    console.log(`   ✅ Signature verification: SKIPPED (implement HMAC if needed)`);
  } else {
    console.log(`   ⚠️ Webhook running without signature verification`);
  }
  console.log('');
}

// ✅ MEJORADO: Log de respuesta
function logWebhookResponse(eventType: string, success: boolean, message: string, taskId?: string) {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  
  console.log(`${status} WEBHOOK RESPONSE [${timestamp}]:`);
  console.log(`   Event: ${eventType}`);
  console.log(`   Task ID: ${taskId || 'none'}`);
  console.log(`   Success: ${success}`);
  console.log(`   Message: ${message}`);
  console.log('========================================================\n');
}

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

export async function GET(req: Request) {
  console.log('📥 GET request to webhook endpoint - probably ClickUp verification');
  
  try {
    const { searchParams } = new URL(req.url)
    const challenge = searchParams.get('challenge')
    
    if (challenge) {
      console.log('🔐 ClickUp webhook verification challenge received:', challenge);
      console.log('✅ Responding with challenge for verification');
      return new Response(challenge, { status: 200 })
    }

    // Tu lógica GET existente...
    const brandId = searchParams.get('brandId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    console.log(`📊 GET request with params: brandId=${brandId}, status=${status}, priority=${priority}, page=${page}`);

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

    console.log(`✅ GET request successful: returned ${tasks.length} tasks`);

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

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    // ✅ NUEVO: Log de headers antes de procesar
    logRequestHeaders(req);
    
    const body = await req.json()
    
    // ✅ MEJORADO: Log de entrada detallado
    logWebhookEntry(req, body);
    
    // ✅ NUEVO: Verificación de webhook
    const signature = req.headers.get('x-signature');
    logWebhookVerification(signature);
    
    // ✅ NUEVO: Validación básica del payload
    if (!body.event) {
      const message = 'Webhook payload missing event type';
      console.error('❌ VALIDATION ERROR:', message);
      logWebhookResponse('UNKNOWN', false, message);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    const event = body as ClickUpWebhookEvent
    
    console.log(`🎯 Processing webhook event: ${event.event}`);
    
    let result;
    let success = true;
    let message = '';
    
    switch (event.event) {
      case 'taskUpdated':
        console.log('📝 Handling taskUpdated event...');
        result = await handleTaskUpdate(event);
        break;
        
      case 'taskCreated':
        console.log('➕ Handling taskCreated event...');
        result = await handleTaskCreated(event);
        break;
        
      case 'taskDeleted':
        console.log('🗑️ Handling taskDeleted event...');
        result = await handleTaskDeleted(event);
        break;
        
      case 'taskStatusUpdated':
        console.log('📊 Handling taskStatusUpdated event...');
        result = await handleTaskStatusUpdate(event);
        break;
        
      case 'taskAssigneeUpdated':
        console.log('👥 Handling taskAssigneeUpdated event...');
        result = await handleTaskAssigneeUpdate(event);
        break;
        
      default:
        message = `Event ${event.event} received but not handled`;
        console.log(`⚠️ ${message}`);
        success = false;
        result = NextResponse.json({ message });
    }
    
    // ✅ NUEVO: Log de timing
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ Webhook processing completed in ${processingTime}ms`);
    
    logWebhookResponse(event.event, success, message || 'Processed successfully', event.task_id);
    
    return result;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ CRITICAL ERROR processing webhook:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.log(`⏱️ Failed after ${processingTime}ms`);
    
    logWebhookResponse('ERROR', false, error instanceof Error ? error.message : 'Unknown error');
    
    // ✅ IMPORTANTE: Devolver 200 para que ClickUp no reintente
    return NextResponse.json({
      error: 'Error processing webhook',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 200 })
  }
}

// ✅ Los handlers existentes con logs mejorados...

async function handleTaskUpdate(event: ClickUpWebhookEvent) {
  console.log('📝 === HANDLING TASK UPDATE ===');
  console.log(`📋 Task ID: ${event.task_id}`);
  
  if (!event.task_id) {
    console.error('❌ No task_id in update event');
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    // Log de búsqueda de tarea
    console.log(`🔍 Looking for task ${event.task_id} in local database...`);
    
    const existingTask = await prisma.task.findUnique({
      where: { id: event.task_id },
      include: {
        assignees: true
      }
    })

    if (!existingTask) {
      console.log(`⚠️ Task ${event.task_id} not found in local DB`);
      
      // ✅ Intentar obtener desde ClickUp API
      if (CLICKUP_TOKEN) {
        try {
          console.log('🔍 Fetching task details from ClickUp API...');
          const clickupResponse = await axios.get(
            `https://api.clickup.com/api/v2/task/${event.task_id}`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          )
          console.log('✅ Task details obtained from ClickUp:', clickupResponse.data.name);
        } catch (apiError) {
          console.error('❌ Error fetching from ClickUp API:', apiError)
        }
      }
      
      return NextResponse.json({ 
        message: 'Task not found locally',
        suggestion: 'Task may need to be synced first'
      })
    }
    
    console.log(`✅ Found existing task: "${existingTask.name}"`);
    console.log(`📊 Current status: ${existingTask.status}`);
    console.log(`🔥 Current priority: ${existingTask.priority}`);

    // Preparar datos de actualización con logs detallados
    const updateData: any = {}
    const taskData = event.task

    if (taskData) {
      console.log('📝 Processing task data updates...');
      
      if (taskData.name && taskData.name !== existingTask.name) {
        updateData.name = taskData.name
        console.log(`📝 Name change: "${existingTask.name}" → "${taskData.name}"`)
      }

      if (taskData.description !== undefined && taskData.description !== existingTask.description) {
        updateData.description = taskData.description || null
        console.log(`📝 Description updated`)
      }

      if (taskData.status) {
        const newStatus = mapClickUpStatusToLocal(taskData.status.status)
        if (newStatus !== existingTask.status) {
          updateData.status = newStatus
          console.log(`📊 Status change: ${existingTask.status} → ${newStatus}`)
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
          console.log(`🔥 Priority change: ${existingTask.priority} → ${newPriority}`)
        }
      }

      if (taskData.start_date !== undefined) {
        const newStartDate = taskData.start_date ? new Date(parseInt(taskData.start_date)) : null
        if (newStartDate && newStartDate.getTime() !== existingTask.startDate.getTime()) {
          updateData.startDate = newStartDate
          console.log(`📅 Start date change: ${existingTask.startDate.toISOString()} → ${newStartDate.toISOString()}`)
        }
      }

      if (taskData.due_date !== undefined) {
        const newDeadline = taskData.due_date ? new Date(parseInt(taskData.due_date)) : null
        if (newDeadline && newDeadline.getTime() !== existingTask.deadline.getTime()) {
          updateData.deadline = newDeadline
          console.log(`📅 Deadline change: ${existingTask.deadline.toISOString()} → ${newDeadline.toISOString()}`)
        }
      }

      if (taskData.time_estimate !== undefined) {
        updateData.timeEstimate = taskData.time_estimate
        console.log(`⏱️ Time estimate change: ${existingTask.timeEstimate} → ${taskData.time_estimate}`)
      }
    }

    // Actualizar si hay cambios
    if (Object.keys(updateData).length > 0) {
      updateData.lastSyncAt = new Date()
      updateData.syncStatus = 'SYNCED'

      console.log(`💾 Updating task with ${Object.keys(updateData).length} changes...`);

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

      console.log(`✅ Task ${event.task_id} updated successfully`);
      console.log(`📝 Changed fields: ${Object.keys(updateData).join(', ')}`);

      // Emitir evento Socket.IO
      try {
        console.log('📡 Emitting socket event...');
        await axios.post('https://assignify.vercel.app/api/socket_emitter', {
          eventName: 'task_update',
          data: updatedTask,
        })
        console.log('✅ Socket event emitted successfully');
      } catch (emitterError) {
        console.error('⚠️ Error emitting socket event:', emitterError)
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Task updated successfully',
        taskId: event.task_id,
        updatedFields: Object.keys(updateData),
        taskName: updatedTask.name
      })
    } else {
      console.log('ℹ️ No changes detected - task already up to date');
      return NextResponse.json({ 
        success: true, 
        message: 'No changes needed - task already synchronized',
        taskId: event.task_id
      })
    }

  } catch (error) {
    console.error('❌ Error updating task:', error)
    console.error('❌ Error details:', error instanceof Error ? error.stack : 'No stack available')
    
    return NextResponse.json({ 
      error: 'Error updating task',
      details: error instanceof Error ? error.message : 'Unknown error',
      taskId: event.task_id
    })
  }
}

async function handleTaskCreated(event: ClickUpWebhookEvent) {
  console.log('➕ === HANDLING TASK CREATION ===');
  console.log(`📋 Task ID: ${event.task_id}`);
  console.log(`📝 Task Name: ${event.task?.name || 'Unknown'}`);
  
  return NextResponse.json({ 
    message: 'Task creation noted',
    taskId: event.task_id,
    note: 'New tasks from ClickUp should be synced manually via sync interface'
  })
}

async function handleTaskDeleted(event: ClickUpWebhookEvent) {
  console.log('🗑️ === HANDLING TASK DELETION ===');
  console.log(`📋 Task ID: ${event.task_id}`);
  
  if (!event.task_id) {
    return NextResponse.json({ error: 'No task_id provided' })
  }

  try {
    console.log(`🔍 Looking for task ${event.task_id} to mark as deleted...`);
    
    const task = await prisma.task.findUnique({
      where: { id: event.task_id }
    });

    if (!task) {
      console.log(`⚠️ Task ${event.task_id} not found in local database`);
      return NextResponse.json({ 
        message: 'Task not found in local database',
        taskId: event.task_id
      });
    }

    // Soft delete o cambiar estado
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: 'COMPLETE',
        syncStatus: 'DELETED',
        lastSyncAt: new Date()
      }
    })

    console.log(`✅ Task ${event.task_id} marked as deleted/completed`);
    
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
  console.log('📊 === HANDLING STATUS UPDATE ===');
  console.log(`📋 Task ID: ${event.task_id}`);
  console.log(`📊 New Status: ${event.task?.status?.status || 'Unknown'}`);
  
  if (!event.task_id || !event.task?.status) {
    return NextResponse.json({ error: 'Missing required data for status update' })
  }

  try {
    const newStatus = mapClickUpStatusToLocal(event.task.status.status)
    console.log(`📊 Mapped status: ${event.task.status.status} → ${newStatus}`);
    
    await prisma.task.update({
      where: { id: event.task_id },
      data: {
        status: newStatus,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED'
      }
    })

    console.log(`✅ Task ${event.task_id} status updated to ${newStatus}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Status updated successfully',
      taskId: event.task_id,
      newStatus,
      originalStatus: event.task.status.status
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
  console.log('👥 === HANDLING ASSIGNEE UPDATE ===');
  console.log(`📋 Task ID: ${event.task_id}`);
  console.log(`👥 Assignees count: ${event.task?.assignees?.length || 0}`);
  
  if (!event.task_id || !event.task?.assignees) {
    return NextResponse.json({ error: 'Missing required data for assignee update' })
  }

  try {
    // Eliminar asignaciones existentes
    console.log('🗑️ Removing existing task assignments...');
    await prisma.taskAssignment.deleteMany({
      where: { taskId: event.task_id }
    })

    // Crear nuevas asignaciones
    const newAssignments = []
    console.log('👥 Processing new assignees...');
    
    for (const assignee of event.task.assignees) {
      console.log(`   🔍 Checking assignee: ${assignee.username} (ID: ${assignee.id})`);
      
      const user = await prisma.user.findUnique({
        where: { id: assignee.id.toString() }
      })

      if (user) {
        newAssignments.push({
          userId: user.id,
          taskId: event.task_id
        })
        console.log(`   ✅ Added assignee: ${assignee.username}`);
      } else {
        console.log(`   ⚠️ User ${assignee.username} (${assignee.id}) not found in local database`);
      }
    }

    if (newAssignments.length > 0) {
      await prisma.taskAssignment.createMany({
        data: newAssignments
      })
    }

    console.log(`✅ Task ${event.task_id} assignees updated (${newAssignments.length} assignees)`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Assignees updated successfully',
      taskId: event.task_id,
      assigneeCount: newAssignments.length,
      processedAssignees: event.task.assignees.length
    })
  } catch (error) {
    console.error('❌ Error updating assignees:', error)
    return NextResponse.json({ 
      error: 'Error updating assignees',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}