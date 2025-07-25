/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/[taskId]/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

interface RouteParams {
  params: {
    taskId: string;
  };
}

/**
 * GET /api/sync/clickup-tasks/[taskId]
 * Obtiene información detallada de una tarea específica de ClickUp
 */
export async function GET(req: Request, { params }: RouteParams) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  const { taskId } = params;

  if (!taskId) {
    return NextResponse.json({
      error: 'taskId es requerido'
    }, { status: 400 });
  }

  try {
    console.log(`🔍 Obteniendo información detallada de la tarea ${taskId}...`);

    const clickupTaskResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const clickupTask = clickupTaskResponse.data;

    // Ahora buscar en la DB local usando la URL
    const localTask = await prisma.task.findFirst({
      where: { url: clickupTask.url },
      include: {
        assignees: {
          include: {
            user: true
          }
        },
        category: {
          include: {
            type: true,
            tierList: true
          }
        },
        brand: true
      }
    });

    // Información combinada
    const taskInfo = {
      clickup: {
        id: clickupTask.id,
        customId: clickupTask.custom_id,
        name: clickupTask.name,
        description: clickupTask.description,
        textContent: clickupTask.text_content,
        status: {
          id: clickupTask.status.id,
          status: clickupTask.status.status,
          color: clickupTask.status.color,
          type: clickupTask.status.type
        },
        priority: clickupTask.priority ? {
          id: clickupTask.priority.id,
          priority: clickupTask.priority.priority,
          color: clickupTask.priority.color
        } : null,
        assignees: clickupTask.assignees.map((assignee: any) => ({
          id: assignee.id.toString(),
          username: assignee.username,
          email: assignee.email,
          color: assignee.color,
          initials: assignee.initials
        })),
        dueDate: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)).toISOString() : null,
        startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)).toISOString() : null,
        timeEstimate: clickupTask.time_estimate,
        timeSpent: clickupTask.time_spent,
        points: clickupTask.points,
        tags: clickupTask.tags.map((tag: any) => ({
          name: tag.name,
          color: tag.tag_bg
        })),
        list: {
          id: clickupTask.list.id,
          name: clickupTask.list.name
        },
        folder: {
          id: clickupTask.folder.id,
          name: clickupTask.folder.name
        },
        space: {
          id: clickupTask.space.id,
          name: clickupTask.space.name
        },
        url: clickupTask.url,
        dateCreated: new Date(parseInt(clickupTask.date_created)).toISOString(),
        dateUpdated: new Date(parseInt(clickupTask.date_updated)).toISOString(),
        dateClosed: clickupTask.date_closed ? new Date(parseInt(clickupTask.date_closed)).toISOString() : null,
      },
      local: localTask ? {
        id: localTask.id,
        name: localTask.name,
        description: localTask.description,
        status: localTask.status,
        priority: localTask.priority,
        startDate: localTask.startDate.toISOString(),
        deadline: localTask.deadline.toISOString(),
        timeEstimate: localTask.timeEstimate,
        points: localTask.points,
        tags: localTask.tags,
        assignees: localTask.assignees.map(assignment => ({
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email
        })),
        category: localTask.category ? {
          id: localTask.category.id,
          name: localTask.category.name,
          type: localTask.category.type.name,
          tier: localTask.category.tierList.name
        } : null,
        brand: {
          id: localTask.brand.id,
          name: localTask.brand.name
        },
        url: localTask.url,
        createdAt: localTask.createdAt.toISOString(),
        updatedAt: localTask.updatedAt.toISOString()
      } : null,
      syncStatus: {
        existsInLocal: !!localTask,
        canSync: !localTask,
        lastSyncCheck: new Date().toISOString()
      }
    };

    console.log(`✅ Información obtenida para tarea ${clickupTask.name}`);

    return NextResponse.json(taskInfo);

  } catch (error) {
    console.error(`❌ Error obteniendo tarea ${taskId}:`, error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener tarea de ClickUp',
        details: message,
        status: status
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * POST /api/sync/clickup-tasks/[taskId]
 * Sincroniza una tarea específica de ClickUp a la base de datos local
 */
export async function POST(req: Request, { params }: RouteParams) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  const { taskId } = params;

  if (!taskId) {
    return NextResponse.json({
      error: 'taskId es requerido'
    }, { status: 400 });
  }

  try {
    const { categoryId, brandId }: { categoryId?: number; brandId: string } = await req.json();

    if (!brandId) {
      return NextResponse.json({
        error: 'brandId es requerido'
      }, { status: 400 });
    }

    console.log(`🔄 Sincronizando tarea individual ${taskId}...`);

    // Obtener información de la tarea desde ClickUp
    const clickupTaskResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const clickupTask = clickupTaskResponse.data;

    // Verificar que la tarea no exista ya en la DB local
    const existingTask = await prisma.task.findFirst({
      where: { url: clickupTask.url },
      select: { id: true, name: true, url: true }
    });

    if (existingTask) {
      return NextResponse.json({
        error: 'La tarea ya existe en la base de datos local',
        existingTask: existingTask
      }, { status: 409 });
    }

    // Verificar que el brand existe
    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return NextResponse.json({
        error: 'Brand no encontrado'
      }, { status: 404 });
    }

    // Generar ID único para la tarea
    const newTaskId = clickupTask.id; 

    // Crear tarea en la base de datos local
    const newTask = await prisma.task.create({
      data: {
        id: newTaskId,
        name: clickupTask.name,
        description: clickupTask.description || clickupTask.text_content || '',
        status: clickupTask.status.status,
        priority: clickupTask.priority?.priority,
        startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : new Date(),
        deadline: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null,
        points: clickupTask.points,
        tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
        url: clickupTask.url,
        typeId: categoryId ? (await prisma.taskCategory.findUnique({ where: { id: categoryId }, include: { type: true } }))?.typeId || 1 : 1,
        categoryId: categoryId || 1,
        brandId: brandId,
      },
      include: {
        category: {
          include: {
            type: true,
            tierList: true
          }
        },
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      }
    });

    // Crear asignaciones si hay assignees válidos
    if (clickupTask.assignees && clickupTask.assignees.length > 0) {
      for (const assignee of clickupTask.assignees) {
        const assigneeId = assignee.id.toString();
        
        const userExists = await prisma.user.findUnique({
          where: { id: assigneeId }
        });
        
        if (userExists) {
          try {
            await prisma.taskAssignment.create({
              data: {
                userId: assigneeId,
                taskId: newTaskId
              }
            });
            console.log(`✅ Usuario ${assignee.username} asignado a tarea`);
          } catch (assignError) {
            console.warn(`⚠️ Error asignando usuario ${assignee.username}:`, assignError);
          }
        } else {
          console.warn(`⚠️ Usuario ${assigneeId} no existe en DB local`);
        }
      }
    }

    console.log(`✅ Tarea ${newTask.name} sincronizada exitosamente`);

    return NextResponse.json({
      message: 'Tarea sincronizada exitosamente',
      task: newTask,
      clickupData: {
        name: clickupTask.name,
        status: clickupTask.status.status,
        assignees: clickupTask.assignees.map((a: any) => a.username),
        list: clickupTask.list.name,
        space: clickupTask.space.name
      }
    });

  } catch (error) {
    console.error(`❌ Error sincronizando tarea ${taskId}:`, error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener tarea de ClickUp',
        details: message
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor durante la sincronización',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/sync/clickup-tasks/[taskId]
 * Elimina una tarea de la base de datos local (NO de ClickUp)
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const { taskId } = params;

  if (!taskId) {
    return NextResponse.json({
      error: 'taskId es requerido'
    }, { status: 400 });
  }

  try {
    console.log(`🗑️ Eliminando tarea ${taskId} de la base de datos local...`);

    // Encontrar la tarea por URL (ya que no guardamos clickupTaskId)
    // Primero obtener la URL de ClickUp para el taskId
    const clickupTaskResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const clickupUrl = clickupTaskResponse.data.url;

    const existingTask = await prisma.task.findFirst({
      where: { url: clickupUrl },
      include: {
        assignees: {
          include: {
            user: true
          }
        }
      }
    });

    if (!existingTask) {
      return NextResponse.json({
        error: 'Tarea no encontrada en la base de datos local',
        clickupTaskId: taskId
      }, { status: 404 });
    }

    // Eliminar asignaciones primero
    await prisma.taskAssignment.deleteMany({
      where: { taskId: existingTask.id }
    });

    // Eliminar tarea
    await prisma.task.delete({
      where: { id: existingTask.id }
    });

    console.log(`✅ Tarea ${existingTask.name} eliminada exitosamente`);

    return NextResponse.json({
      message: 'Tarea eliminada exitosamente',
      deletedTask: {
        id: existingTask.id,
        name: existingTask.name,
        url: existingTask.url
      }
    });

  } catch (error) {
    console.error(`❌ Error eliminando tarea ${taskId}:`, error);
    
    return NextResponse.json({
      error: 'Error interno del servidor durante la eliminación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}