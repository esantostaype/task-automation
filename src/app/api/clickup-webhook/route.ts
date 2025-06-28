/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/clickup-webhook/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Status, Priority } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

// Importar las utilidades
import { 
  mapClickUpStatusToLocal, 
  inferTaskTypeAndCategory
} from '@/utils/clickup-task-mapping-utils';
import { createSyncLog } from '@/utils/sync-log-utils';
import { 
  shiftUserTasks, 
  getNextAvailableStart, 
  calculateWorkingDeadline 
} from '@/utils/task-calculation-utils';
import { determineQueueInsertPosition } from '@/utils/priority-utils';

// Define la interfaz para el servidor de Socket.IO en el objeto de respuesta
interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

// Extendemos el tipo Request de Next.js para incluir la propiedad socket
interface AppRouterRequest extends Request {
  socket: SocketWithIO;
}

// Asegúrate de tener tu token de ClickUp en las variables de entorno
const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;

// Mapeo de prioridades de ClickUp (número) a tus enums locales (string)
const clickupPriorityToLocal: Record<number, Priority> = {
  1: Priority.URGENT,
  2: Priority.HIGH,
  3: Priority.NORMAL,
  4: Priority.LOW,
};

// Función para obtener los detalles completos de una tarea desde ClickUp
async function fetchClickUpTask(taskId: string): Promise<any> {
  if (!CLICKUP_API_TOKEN) {
    throw new Error('Token de ClickUp no configurado');
  }

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener tarea de ClickUp: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error al hacer fetch de la tarea de ClickUp:', error);
    throw error;
  }
}

// Función para calcular fechas y posición en cola para una nueva tarea
async function calculateTaskScheduling(
  assigneeIds: string[], 
  priority: Priority, 
  categoryDuration: number
): Promise<{ startDate: Date; deadline: Date; queuePosition: number }> {
  if (assigneeIds.length === 0) {
    // Sin asignados, usar fechas por defecto
    const now = new Date();
    const startDate = await getNextAvailableStart(now);
    const deadline = await calculateWorkingDeadline(startDate, categoryDuration * 8);
    return { startDate, deadline, queuePosition: 0 };
  }

  // Por simplicidad, usar el primer asignado para calcular la cola
  const primaryAssigneeId = assigneeIds[0];
  
  // Obtener la cola actual del usuario
  const userQueue = await prisma.task.findMany({
    where: {
      status: { in: [Status.TO_DO, Status.IN_PROGRESS, Status.ON_APPROVAL] },
      assignees: {
        some: { userId: primaryAssigneeId }
      }
    },
    orderBy: { queuePosition: 'asc' },
    include: { category: true }
  });

  // Determinar posición en la cola
  const queuePosition = determineQueueInsertPosition(userQueue, priority);
  
  // Calcular fechas basándose en la posición
  let startDate: Date;
  
  if (queuePosition === 0 || userQueue.length === 0) {
    // Primera posición o cola vacía
    startDate = await getNextAvailableStart(new Date());
  } else {
    // Encontrar la tarea después de la cual se insertará
    const taskBefore = userQueue[queuePosition - 1];
    if (taskBefore && taskBefore.deadline) {
      startDate = await getNextAvailableStart(taskBefore.deadline);
    } else {
      startDate = await getNextAvailableStart(new Date());
    }
  }
  
  const deadline = await calculateWorkingDeadline(startDate, categoryDuration * 8);
  
  return { startDate, deadline, queuePosition };
}

export async function POST(req: AppRouterRequest) {
  console.log('📩 Webhook recibido:', new Date());
  
  try {
    const payload = await req.json();
    console.log("🧾 Payload real recibido de Clickup:", JSON.stringify(payload, null, 2));

    const event = payload.event;
    let localEntity: any = null;

    switch (event) {
      // --- Eventos de Tareas ---
      case 'taskCreated':
      case 'taskUpdated':
      case 'taskDeleted':
        const taskId = payload.task_id;
        
        if (!taskId) {
          console.warn('Payload no contiene task_id válido.');
          return NextResponse.json({ message: 'task_id no encontrado en el payload' }, { status: 400 });
        }

        console.log(`Procesando evento ${event} para tarea ${taskId}`);

        let clickupTask: any = null;
        
        // Para eventos de creación y actualización, obtener los detalles de ClickUp
        if (event === 'taskCreated' || event === 'taskUpdated') {
          try {
            const taskResponse = await fetchClickUpTask(taskId);
            clickupTask = taskResponse;
            console.log(`Detalles de tarea obtenidos desde ClickUp:`, JSON.stringify(clickupTask, null, 2));
          } catch (error) {
            console.error(`Error al obtener detalles de tarea ${taskId}:`, error);
            await createSyncLog('Task', null, taskId, 'SYNC', 'ERROR', 
              `Error al obtener tarea de ClickUp: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return NextResponse.json({ 
              message: 'Error al obtener detalles de la tarea desde ClickUp',
              error: error instanceof Error ? error.message : 'Unknown error'
            }, { status: 500 });
          }
        }

        const existingTask = await prisma.task.findUnique({
          where: { id: taskId },
          include: { brand: true, category: true }
        });

        if (event === 'taskDeleted') {
          if (existingTask) {
            console.log(`Webhook: Eliminando tarea ${taskId} de DB local.`);
            await prisma.taskAssignment.deleteMany({ where: { taskId: existingTask.id } });
            localEntity = await prisma.task.delete({ where: { id: existingTask.id } });
            await createSyncLog('Task', null, existingTask.id, 'DELETE', 'SUCCESS');
          } else {
            console.log(`Tarea ${taskId} no existe localmente, no se puede eliminar.`);
          }
          break;
        }

        // Para eventos de creación y actualización, procesar la tarea
        if (!clickupTask) {
          console.error('No se pudieron obtener los detalles de la tarea');
          return NextResponse.json({ message: 'No se pudieron obtener los detalles de la tarea' }, { status: 500 });
        }

        // Buscar Brand por los campos correctos del schema
        let brand = null;
        
        if (clickupTask.space?.id) {
          brand = await prisma.brand.findFirst({
            where: { spaceId: clickupTask.space.id }
          });
        }
        
        if (!brand && clickupTask.folder?.id) {
          brand = await prisma.brand.findFirst({
            where: { folderId: clickupTask.folder.id }
          });
        }
        
        if (!brand && clickupTask.team_id) {
          brand = await prisma.brand.findFirst({
            where: { teamId: clickupTask.team_id.toString() }
          });
        }

        if (!brand) {
          console.warn(`Webhook: Brand local no encontrado para ClickUp Task. Space ID: ${clickupTask.space?.id}, Folder ID: ${clickupTask.folder?.id}, Team ID: ${clickupTask.team_id}. Omitiendo sincronización de tarea.`);
          await createSyncLog('Task', null, taskId, 'SYNC', 'ERROR', 'Brand no encontrado localmente');
          return NextResponse.json({ message: 'Brand no encontrado localmente' }, { status: 404 });
        }

        // Usar la función de utilidad para inferir tipo y categoría
        const { typeId, categoryId } = await inferTaskTypeAndCategory(
          clickupTask.name, 
          clickupTask.tags ? clickupTask.tags.map((t: any) => t.name) : []
        );

        // Obtener la categoría para los cálculos
        const taskCategory = await prisma.taskCategory.findUnique({
          where: { id: categoryId }
        });

        if (!taskCategory) {
          console.error('TaskCategory no encontrada después de la inferencia');
          return NextResponse.json({ message: 'Error en la inferencia de categoría' }, { status: 500 });
        }

        // Mapear asignados de ClickUp a IDs de usuarios locales
        const clickupAssigneeIds = clickupTask.assignees ? clickupTask.assignees.map((a: any) => a.id.toString()) : [];
        const localAssignees = await prisma.user.findMany({
          where: { id: { in: clickupAssigneeIds } },
          select: { id: true },
        });
        const localAssigneeIds = localAssignees.map(u => u.id);

        // Mapear prioridad usando la utilidad
        const taskPriority = clickupPriorityToLocal[clickupTask.priority] || Priority.NORMAL;

        if (event === 'taskCreated' || (event === 'taskUpdated' && !existingTask)) {
          if (!existingTask) {
            console.log(`Webhook: Creando tarea ${taskId} en DB local.`);
            
            // Calcular fechas y posición en cola
            const scheduling = await calculateTaskScheduling(
              localAssigneeIds, 
              taskPriority, 
              taskCategory.duration
            );

            localEntity = await prisma.task.create({
              data: {
                id: taskId,
                name: clickupTask.name,
                description: clickupTask.description || null,
                status: mapClickUpStatusToLocal(clickupTask.status.status, brand.statusMapping),
                priority: taskPriority,
                startDate: scheduling.startDate,
                deadline: scheduling.deadline,
                url: clickupTask.url || null,
                lastSyncAt: new Date(),
                syncStatus: 'SYNCED',
                typeId: typeId,
                categoryId: categoryId,
                brandId: brand.id,
                queuePosition: scheduling.queuePosition,
              },
            });

            // Sincronizar asignaciones
            if (localAssigneeIds.length > 0) {
              await prisma.taskAssignment.createMany({
                data: localAssigneeIds.map(userId => ({
                  taskId: localEntity.id,
                  userId: userId,
                })),
                skipDuplicates: true,
              });

              // Reordenar las colas de los usuarios asignados
              for (const userId of localAssigneeIds) {
                await shiftUserTasks(userId, localEntity.id, scheduling.deadline, scheduling.queuePosition);
              }
            }

            await createSyncLog('Task', null, localEntity.id, 'CREATE', 'SUCCESS');
          }
        } else if (event === 'taskUpdated' && existingTask) {
          console.log(`Webhook: Actualizando tarea ${taskId} en DB local.`);
          
          localEntity = await prisma.task.update({
            where: { id: existingTask.id },
            data: {
              name: clickupTask.name,
              description: clickupTask.description || null,
              status: mapClickUpStatusToLocal(clickupTask.status.status, brand.statusMapping),
              priority: taskPriority,
              startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : existingTask.startDate,
              deadline: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : existingTask.deadline,
              url: clickupTask.url || existingTask.url,
              lastSyncAt: new Date(),
              syncStatus: 'SYNCED',
              typeId: typeId,
              categoryId: categoryId,
              brandId: brand.id,
            },
          });

          // Actualizar asignaciones
          await prisma.taskAssignment.deleteMany({
            where: { taskId: localEntity.id },
          });
          
          if (localAssigneeIds.length > 0) {
            await prisma.taskAssignment.createMany({
              data: localAssigneeIds.map(userId => ({
                taskId: localEntity.id,
                userId: userId,
              })),
              skipDuplicates: true,
            });
          }

          await createSyncLog('Task', null, localEntity.id, 'UPDATE', 'SUCCESS');
        }
        break;

      // --- Eventos de Usuarios ---
      case 'userCreated':
      case 'userUpdated':
      case 'userDeleted':
        const clickupUser = payload.user || payload.member;
        if (!clickupUser || !clickupUser.id) {
          console.warn('Payload de usuario inválido o sin ID.');
          return NextResponse.json({ message: 'Payload de usuario inválido' }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
          where: { id: clickupUser.id.toString() },
        });

        if (event === 'userCreated' || (event === 'userUpdated' && !existingUser)) {
          if (!existingUser) {
            console.log(`Webhook: Creando usuario ${clickupUser.id} en DB local.`);
            localEntity = await prisma.user.create({
              data: {
                id: clickupUser.id.toString(),
                name: clickupUser.username,
                email: clickupUser.email,
                active: clickupUser.state === 'active',
              },
            });
            await createSyncLog('User', null, localEntity.id, 'CREATE', 'SUCCESS');
          }
        } else if (event === 'userUpdated' && existingUser) {
          console.log(`Webhook: Actualizando usuario ${clickupUser.id} en DB local.`);
          localEntity = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: clickupUser.username,
              email: clickupUser.email,
              active: clickupUser.state === 'active',
            },
          });
          await createSyncLog('User', null, localEntity.id, 'UPDATE', 'SUCCESS');
        } else if (event === 'userDeleted' && existingUser) {
          console.log(`Webhook: Marcando usuario ${clickupUser.id} como inactivo en DB local.`);
          localEntity = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              active: false,
            },
          });
          await createSyncLog('User', null, existingUser.id, 'DELETE', 'SUCCESS');
        }
        break;

      // --- Eventos de Listas (Mapear a Brands) ---
      case 'listCreated':
      case 'listUpdated':
      case 'listDeleted':
        const clickupList = payload.list;
        if (!clickupList || !clickupList.id) {
          console.warn('Payload de lista inválido o sin ID.');
          return NextResponse.json({ message: 'Payload de lista inválido' }, { status: 400 });
        }

        const existingBrand = await prisma.brand.findFirst({
          where: {
            OR: [
              { spaceId: clickupList.space?.id },
              { folderId: clickupList.folder?.id },
              { teamId: clickupList.team_id?.toString() }
            ]
          }
        });

        if (event === 'listCreated' || (event === 'listUpdated' && !existingBrand)) {
          if (!existingBrand) {
            console.log(`Webhook: Creando Brand para lista ${clickupList.id} en DB local.`);
            
            const brandId = `brand_${clickupList.id}_${Date.now()}`;
            
            localEntity = await prisma.brand.create({
              data: {
                id: brandId,
                name: clickupList.name,
                spaceId: clickupList.space?.id || null,
                folderId: clickupList.folder?.id || null,
                teamId: clickupList.team_id?.toString() || null,
                isActive: true,
                defaultStatus: Status.TO_DO,
              },
            });
            await createSyncLog('Brand', null, localEntity.id, 'CREATE', 'SUCCESS');
          }
        } else if (event === 'listUpdated' && existingBrand) {
          console.log(`Webhook: Actualizando Brand para lista ${clickupList.id} en DB local.`);
          localEntity = await prisma.brand.update({
            where: { id: existingBrand.id },
            data: {
              name: clickupList.name,
              isActive: true,
            },
          });
          await createSyncLog('Brand', null, localEntity.id, 'UPDATE', 'SUCCESS');
        } else if (event === 'listDeleted' && existingBrand) {
          console.log(`Webhook: Marcando Brand para lista ${clickupList.id} como inactivo en DB local.`);
          localEntity = await prisma.brand.update({
            where: { id: existingBrand.id },
            data: {
              isActive: false,
            },
          });
          await createSyncLog('Brand', null, existingBrand.id, 'DELETE', 'SUCCESS');
        }
        break;

      default:
        console.log(`Evento de ClickUp no manejado: ${event}`);
        break;
    }

    // ✅ Emitir evento de Socket.IO
    if (localEntity) {
      const io = (req as any).socket?.server?.io;
      if (io) {
        let entityWithRelations: any;
        if (event.startsWith('task')) {
          entityWithRelations = await prisma.task.findUnique({
            where: { id: localEntity.id },
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
          });
        } else if (event.startsWith('user')) {
          entityWithRelations = await prisma.user.findUnique({
            where: { id: localEntity.id },
            include: { roles: true, tasks: true }
          });
        } else if (event.startsWith('list')) {
          entityWithRelations = await prisma.brand.findUnique({
            where: { id: localEntity.id },
            include: { tasks: true, userRoles: true }
          });
        }

        if (entityWithRelations) {
          io.emit('data_update', { type: event.replace(/ed$/, ''), data: entityWithRelations });
          console.log(`Evento 'data_update' (${event}) emitido por webhook para ${event.startsWith('task') ? 'tarea' : event.startsWith('user') ? 'usuario' : 'brand'} ${localEntity.id}`);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Evento ${event} procesado.` });

  } catch (error) {
    console.error('Error en el webhook de ClickUp:', error);
    await createSyncLog('Webhook', 0, null, 'RECEIVE', 'ERROR', 
      `Internal webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return NextResponse.json({
      error: 'Error interno del servidor al procesar webhook',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}