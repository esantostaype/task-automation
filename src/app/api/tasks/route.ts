/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/tasks/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import axios from 'axios'; // Para emitir eventos de Socket.IO y llamar a ClickUp API
import { Status, Priority } from '@prisma/client'; // Importar enums para tipado

// Importar funciones de utilidad
import { calculateWorkingDeadline, getNextAvailableStart } from '@/utils/task-calculation-utils';
import { createSyncLog } from '@/utils/sync-log-utils';
import { clickupPriorityMap, getClickUpStatusName } from '@/utils/clickup-task-mapping-utils'; // ✅ Importado getClickUpStatusName

// Constantes de ClickUp (asegúrate de que estén en tus variables de entorno)
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
/**
 * Maneja las solicitudes GET para obtener todas las tareas.
 * Permite filtrar por brandId, status, priority, y paginación.
 * @param req Objeto de solicitud.
 * @returns Respuesta JSON con la lista de tareas o un error.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Parámetros de filtrado
    const brandId = searchParams.get('brandId'); // brandId es String
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Construir el objeto de filtro
    const where: any = {};
    if (brandId) {
      where.brandId = brandId; // Filtrar por brandId (String)
    }
    if (status && Object.values(Status).includes(status as Status)) {
      where.status = status as Status;
    }
    if (priority && Object.values(Priority).includes(priority as Priority)) {
      where.priority = priority as Status; // Corregido el tipo aquí, debería ser Status si se filtra por enum
    }

    const tasks = await prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        startDate: 'asc', // Ordenar por fecha de inicio por defecto
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

    const totalTasks = await prisma.task.count({ where });

    return NextResponse.json({
      data: tasks,
      pagination: {
        total: totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * Maneja las solicitudes POST para crear una nueva tarea.
 * Asigna automáticamente la tarea a un diseñador o a los especificados,
 * calcula los plazos y emite un evento de Socket.IO para actualizaciones en tiempo real.
 */
export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado.');
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN no configurado' }, { status: 500 });
  }

  try {
    const body = await req.json();
    // Destructure durationDays from the body
    const { name, description, typeId, categoryId, priority, brandId, assignedUserIds, durationDays } = body; 

    if (!name || !typeId || !categoryId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({ error: 'Faltan campos requeridos o duración inválida' }, { status: 400 });
    }

    const category = await prisma.taskCategory.findUnique({
      where: { id: categoryId },
      include: { type: true },
    });

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId }, // brandId es el ClickUp List ID
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand no encontrado' }, { status: 404 });
    }

    let usersToAssign: string[] = []; 
    let chosenUserId: string | null = null; 
    let userSlots: any[] = []; 

    if (assignedUserIds && assignedUserIds.length > 0) {
      usersToAssign = assignedUserIds;
      console.log('Asignando tarea a usuarios especificados manualmente:', usersToAssign);
    } else {
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
      });

      const compatibleUsers = allUsersWithRoles.filter(user =>
        user.roles.some(role => role.typeId === typeId)
      );

      if (compatibleUsers.length === 0) {
        return NextResponse.json({ error: 'No hay usuarios compatibles disponibles para asignación automática' }, { status: 400 });
      }

      userSlots = await Promise.all(compatibleUsers.map(async (user) => {
        const tasks = await prisma.task.findMany({
          where: { 
            typeId: typeId,
            brandId: brandId, 
            assignees: {
              some: {
                userId: user.id
              }
            }
          },
          orderBy: { queuePosition: 'asc' },
          include: { category: true },
        });

        const cargaTotal = tasks.length; 

        let availableDate;
        if (tasks.length > 0) {
          availableDate = new Date(tasks[tasks.length - 1].deadline);
        } else {
          availableDate = await getNextAvailableStart(new Date());
        }

        const matchingRoles = user.roles.filter(role => role.typeId === typeId);
        const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1; 

        return {
          userId: user.id,
          userName: user.name,
          availableDate,
          tasks,
          cargaTotal,
          isSpecialist,
        };
      }));

      let bestSlot = null;

      const specialists = userSlots.filter(slot => slot.isSpecialist);
      if (specialists.length > 0) {
        specialists.sort((a, b) => {
          if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal; 
          return a.availableDate.getTime() - b.availableDate.getTime(); 
        });
        bestSlot = specialists[0];
        console.log(`Asignación: Especialista preferido encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`);
      }

      const GENERALIST_CONSIDERATION_THRESHOLD = 3; 

      if (!bestSlot || bestSlot.cargaTotal >= GENERALIST_CONSIDERATION_THRESHOLD) {
        const generalists = userSlots.filter(slot => !slot.isSpecialist);
        if (generalists.length > 0) {
          generalists.sort((a, b) => {
            if (a.cargaTotal !== b.cargaTotal) return a.cargaTotal - b.cargaTotal; 
            return a.availableDate.getTime() - b.availableDate.getTime(); 
          });
          if (bestSlot) {
            if (generalists[0].cargaTotal < bestSlot.cargaTotal ||
                generalists[0].availableDate.getTime() < bestSlot.availableDate.getTime() - (2 * 24 * 60 * 60 * 1000) 
            ) {
              bestSlot = generalists[0];
              console.log(`Asignación: Generalista ${bestSlot.userName} elegido sobre especialista por menor carga/disponibilidad.`);
            } else {
              console.log(`Asignación: Especialista ${bestSlot.userName} mantenido, generalista no es significativamente mejor.`);
            }
          } else {
            bestSlot = generalists[0];
            console.log(`Asignación: No hay especialistas, mejor generalista encontrado: ${bestSlot.userName} (Carga: ${bestSlot.cargaTotal})`);
          }
        }
      }
      
      if (!bestSlot) {
        return NextResponse.json({ error: 'No se pudo encontrar un diseñador óptimo para la asignación automática.' }, { status: 400 });
      }

      usersToAssign.push(bestSlot.userId); 
      chosenUserId = bestSlot.userId; 
    }

    // ✅ CAMBIO: Usar durationDays proporcionado por el frontend para calcular newTaskHours
    const newTaskHours = durationDays * 8; 

    let insertAt: number = 0; 
    let calculatedStartDate: Date = await getNextAvailableStart(new Date()); 

    if (chosenUserId !== null) {
      const chosenUserSlot = userSlots.find(slot => slot.userId === chosenUserId);

      if (!chosenUserSlot) {
        return NextResponse.json({ error: 'Error interno: Slot de usuario elegido no encontrado.' }, { status: 500 });
      }

      let finalPriority = priority; 

      if (finalPriority === 'URGENT') {
        insertAt = 0;
        calculatedStartDate = await getNextAvailableStart(new Date());
      } else if (finalPriority === 'HIGH') {
        if (chosenUserSlot.tasks.length >= 1) {
          const firstTask = chosenUserSlot.tasks[0];
          if (firstTask.category && ['E', 'D'].includes(firstTask.category.tier)) {
            insertAt = 1;
            calculatedStartDate = await getNextAvailableStart(new Date(firstTask.deadline));
          } else if (firstTask.category && ['C', 'B', 'A', 'S'].includes(firstTask.category.tier)) {
            insertAt = 0;
            calculatedStartDate = await getNextAvailableStart(new Date());
          } else {
            finalPriority = 'NORMAL'; 
          }
        } else {
          insertAt = 0;
          calculatedStartDate = await getNextAvailableStart(new Date());
        }
      } else if (finalPriority === 'LOW') {
        insertAt = chosenUserSlot.tasks.length;
        calculatedStartDate = chosenUserSlot.availableDate;
      }
      if (finalPriority === 'NORMAL') { 
        let potentialInsertIndexForNormal = chosenUserSlot.tasks.length; 
        
        for (let i = 0; i < chosenUserSlot.tasks.length; i++) {
            const currentTaskInQueue = chosenUserSlot.tasks[i];

            if (currentTaskInQueue.priority === 'LOW') {
                let normalTasksBeforeThisLow = 0;
                for (let j = 0; j < i; j++) {
                    if (chosenUserSlot.tasks[j].priority === 'NORMAL') {
                        normalTasksBeforeThisLow++;
                    }
                }

                if (normalTasksBeforeThisLow < 5) {
                    potentialInsertIndexForNormal = i;
                    break; 
                }
                potentialInsertIndexForNormal = i + 1; 
            } else if (currentTaskInQueue.priority === 'NORMAL') {
                  potentialInsertIndexForNormal = i + 1;
              }
          }
          insertAt = potentialInsertIndexForNormal;

          if (insertAt === 0) { 
              calculatedStartDate = await getNextAvailableStart(new Date());
          } else { 
              const prevTask = chosenUserSlot.tasks[insertAt - 1];
              calculatedStartDate = await getNextAvailableStart(new Date(prevTask.deadline));
          }
      }
    }

    const startDate = calculatedStartDate; 
    const deadline = await calculateWorkingDeadline(startDate, newTaskHours); 

    console.log('✅ Creando tarea con los siguientes parámetros:', {
      name,
      categoryDuration: category.duration,
      userProvidedDurationDays: durationDays, // Log the user-provided duration
      adjustedHours: newTaskHours, 
      startDate: startDate.toISOString(),
      deadline: deadline.toISOString(),
      assignedUsers: usersToAssign, 
      insertAt,
    });

    // --- Lógica de creación de tarea en ClickUp ---
    let clickUpResponse;
    let clickupTaskId: string;
    let clickupTaskUrl: string;

    try {
      // Mapear IDs de usuario locales (string) a IDs de ClickUp (number)
      const clickupAssignees: number[] = [];
      const assigneeDebugInfo: any[] = []; // Para depuración

      for (const userId of usersToAssign) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const debugInfo = { userId, userName: user?.name, clickupId: user?.id, willBeAssigned: false, reason: '' };

        if (!user) {
          debugInfo.reason = 'Usuario no encontrado en DB local.';
        } else if (!user.id) { // user.id es el clickupId del usuario
          debugInfo.reason = 'Usuario no tiene ClickUp ID.';
        } else {
          const clickupIdNum = parseInt(user.id); // user.id es el clickupId del usuario
          if (isNaN(clickupIdNum)) {
            debugInfo.reason = `ClickUp ID no es un número válido: "${user.id}"`;
          } else {
            clickupAssignees.push(clickupIdNum);
            debugInfo.willBeAssigned = true;
            debugInfo.reason = `Asignado: ${clickupIdNum}`;
          }
        }
        assigneeDebugInfo.push(debugInfo);
      }

      console.log('🎯 DEBUG - Procesamiento de asignados para ClickUp:', {
        localUsersToAssign: usersToAssign,
        clickupAssigneesToSend: clickupAssignees,
        assigneeDebugInfo,
      });

      const clickUpPayload = {
        name: name,
        description: description || '',
        priority: clickupPriorityMap[priority] || 3, 
        due_date: deadline.getTime().toString(), 
        start_date: startDate.getTime().toString(), 
        assignees: clickupAssignees, 
        // ✅ CAMBIO: Eliminado 'brand:${brand.name}' de los tags
        tags: [`type:${category.type.name}`, `category:${category.name}`], 
        status: getClickUpStatusName(brand.defaultStatus, brand.statusMapping), 
      };

      console.log('📤 Enviando a ClickUp API:', {
        url: `${CLICKUP_API_BASE}/list/${brand.id}/task`, 
        payload: clickUpPayload,
        headers: { 'Authorization': 'Bearer ' + CLICKUP_TOKEN }, 
      });

      clickUpResponse = await axios.post(
        `${CLICKUP_API_BASE}/list/${brand.id}/task`, 
        clickUpPayload,
        {
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );

      clickupTaskId = clickUpResponse.data.id;
      clickupTaskUrl = clickUpResponse.data.url;

      await createSyncLog('Task', null, clickupTaskId, 'CREATE', 'SUCCESS', undefined, clickUpResponse.data);
      console.log(`✅ Tarea creada en ClickUp: ${clickupTaskId}`);

    } catch (clickupApiError: any) {
      const errorMessage = `Error al crear tarea en ClickUp: ${clickupApiError.response?.data?.err || clickupApiError.message || clickupApiError.toString()}`;
      console.error('❌ Error de ClickUp API:', {
        status: clickupApiError.response?.status,
        statusText: clickupApiError.response?.statusText,
        errorData: clickupApiError.response?.data,
        sentPayload: clickupApiError.config?.data, 
        url: clickupApiError.config?.url, 
        message: clickupApiError.message,
      });
      await createSyncLog('Task', null, 'temp-id-failed-create', 'CREATE', 'ERROR', errorMessage, clickupApiError.response?.data);
      return NextResponse.json({
        error: 'Error al crear tarea en ClickUp',
        details: clickupApiError.response?.data || clickupApiError.message
      }, { status: 500 });
    }

    // Crear la tarea en la base de datos local con el ID y URL de ClickUp
    const task = await prisma.task.create({
      data: {
        id: clickupTaskId, 
        name,
        description,
        typeId: typeId,
        categoryId: categoryId,
        brandId: brandId, 
        priority,
        startDate,
        deadline,
        queuePosition: insertAt,
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

    // Crear las asignaciones de la tarea a los usuarios
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
      },
    });

    try {
      await axios.post('http://localhost:3000/api/socket_emitter', {
        eventName: 'task_update',
        data: taskWithAssignees,
      });
      console.log('Evento task_update enviado al socket-emitter.');
    } catch (emitterError) {
      console.error('Error al enviar evento a socket-emitter:', emitterError);
    }

    return NextResponse.json(taskWithAssignees);

  } catch (error) {
    console.error('Error general al crear tarea:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}