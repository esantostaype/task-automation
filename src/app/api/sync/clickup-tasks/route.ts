// src/app/api/sync/clickup-tasks/route.ts - VERSIÓN CORREGIDA
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

// ✅ NUEVA FUNCIÓN: Calcular queuePosition basado en fechas reales
async function calculateProperQueuePosition(
  userId: string, 
  startDate: Date, 
  deadline: Date,
  typeId: number
): Promise<number> {
  // Obtener todas las tareas del usuario para este tipo, ordenadas por fecha de inicio
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      typeId: typeId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { 
      id: true, 
      startDate: true, 
      deadline: true, 
      queuePosition: true,
      name: true 
    }
  });

  // Si no hay tareas, es la primera
  if (userTasks.length === 0) {
    return 1;
  }

  // Encontrar la posición correcta basada en la fecha de inicio
  let insertPosition = 1;
  
  for (let i = 0; i < userTasks.length; i++) {
    const existingTask = userTasks[i];
    
    // Si la nueva tarea debe ir antes que esta tarea existente
    if (startDate < existingTask.startDate) {
      insertPosition = i + 1;
      break;
    }
    
    // Si llegamos al final, va después de todas
    if (i === userTasks.length - 1) {
      insertPosition = userTasks.length + 1;
    }
  }

  return insertPosition;
}

// ✅ NUEVA FUNCIÓN: Reordenar posiciones de cola después de insertar
async function reorderQueuePositions(
  userId: string, 
  typeId: number, 
  newTaskId: string
): Promise<void> {
  console.log(`🔄 Reordenando posiciones de cola para usuario ${userId}, tipo ${typeId}`);
  
  // Obtener todas las tareas del usuario ordenadas por fecha de inicio
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      typeId: typeId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { id: true, queuePosition: true, startDate: true, name: true }
  });

  // Actualizar las posiciones secuencialmente
  for (let i = 0; i < userTasks.length; i++) {
    const correctPosition = i + 1;
    const task = userTasks[i];
    
    if (task.queuePosition !== correctPosition) {
      await prisma.task.update({
        where: { id: task.id },
        data: { queuePosition: correctPosition }
      });
      
      console.log(`  ✅ Tarea "${task.name}": posición ${task.queuePosition} → ${correctPosition}`);
    }
  }
}

export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 Obteniendo tareas de ClickUp...');

    // ... (código existente para obtener teams, spaces, etc.) ...
    const teamsResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const allSpaces = [];
    for (const team of teamsResponse.data.teams) {
      try {
        const spacesResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/team/${team.id}/space?archived=false`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );
        allSpaces.push(...spacesResponse.data.spaces);
      } catch (error) {
        console.warn(`⚠️ Error obteniendo spaces del team ${team.name}:`, error);
      }
    }

    console.log(`📊 Spaces encontrados: ${allSpaces.length}`);

    const allTasks: any[] = [];
    
    for (const space of allSpaces) {
      try {
        console.log(`   Obteniendo folders del space: ${space.name}`);
        
        const foldersResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/space/${space.id}/folder?archived=false`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        const folders = foldersResponse.data.folders || [];

        // Obtener listas directas del space
        try {
          const spaceListsResponse = await axios.get(
            `${API_CONFIG.CLICKUP_API_BASE}/space/${space.id}/list?archived=false`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json',
              },
            }
          );

          const spaceLists = spaceListsResponse.data.lists || [];
          for (const list of spaceLists) {
            await getTasksFromList(list, allTasks);
          }
        } catch (spaceListError) {
          console.warn(`⚠️ Error obteniendo listas directas del space ${space.name}`);
        }

        // Obtener listas de cada folder
        for (const folder of folders) {
          try {
            const listsResponse = await axios.get(
              `${API_CONFIG.CLICKUP_API_BASE}/folder/${folder.id}/list?archived=false`,
              {
                headers: {
                  'Authorization': CLICKUP_TOKEN,
                  'Content-Type': 'application/json',
                },
              }
            );

            const lists = listsResponse.data.lists || [];
            for (const list of lists) {
              await getTasksFromList(list, allTasks);
            }
          } catch (folderError) {
            console.warn(`⚠️ Error obteniendo listas del folder ${folder.name}`);
          }
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Error obteniendo contenido del space ${space.name}:`, error.response?.status || error.message);
      }
    }

    async function getTasksFromList(list: any, tasksArray: any[]) {
      try {
        console.log(`       Obteniendo tareas de la lista: ${list.name}`);
        
        let page = 0;
        let hasMorePages = true;
        
        while (hasMorePages && page < 5) {
          const tasksResponse = await axios.get(
            `${API_CONFIG.CLICKUP_API_BASE}/list/${list.id}/task`,
            {
              headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json',
              },
              params: {
                archived: false,
                page: page,
                order_by: 'updated',
                reverse: true,
                subtasks: true,
                include_closed: false,
              }
            }
          );

          const tasks = tasksResponse.data.tasks || [];
          
          // ✅ FILTRAR SOLO TAREAS CON ESTADOS TO_DO E IN_PROGRESS
          const filteredTasks = tasks.filter((task: any) => {
            const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
            return mappedStatus === 'TO_DO' || mappedStatus === 'IN_PROGRESS';
          });
          
          tasksArray.push(...filteredTasks);
          
          console.log(`         Página ${page}: ${tasks.length} tareas totales, ${filteredTasks.length} filtradas`);
          
          hasMorePages = tasks.length > 0 && tasks.length >= 100;
          page++;
        }
        
      } catch (taskError: any) {
        console.warn(`       ⚠️ Error obteniendo tareas de la lista ${list.name}:`, taskError.response?.status || taskError.message);
      }
    }

    console.log(`🎯 Total de tareas encontradas y filtradas en ClickUp: ${allTasks.length}`);

    // Obtener tareas existentes en la DB local
    const localTasks = await prisma.task.findMany({
      select: { 
        id: true, 
        name: true, 
        status: true, 
        url: true
      }
    });

    console.log(`💾 Tareas en DB local: ${localTasks.length}`);

    const localTaskIds = new Set(localTasks.map(task => task.id));
    const localTaskUrls = new Set(localTasks.map(task => task.url).filter(Boolean));

    // ✅ MEJORADO: Verificar estados más detalladamente
    const clickupTasksWithSyncStatus = allTasks
      .filter(clickupTask => {
        if (!clickupTask.id || !clickupTask.name) {
          console.warn(`⚠️ Tarea sin ID/nombre omitida:`, clickupTask.id);
          return false;
        }
        
        // ✅ VERIFICAR ESTADO MAPEADO
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');
        console.log(`📋 Tarea "${clickupTask.name}": ${clickupTask.status?.status} → ${mappedStatus}`);
        
        return true;
      })
      .map(clickupTask => {
        const taskId = clickupTask.id;
        const taskUrl = clickupTask.url;
        
        const existsByQuery = localTaskIds.has(taskId) || localTaskUrls.has(taskUrl);
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');
        
        return {
          clickupId: taskId,
          customId: clickupTask.custom_id,
          name: clickupTask.name,
          description: clickupTask.description || clickupTask.text_content || '',
          status: mappedStatus, // ✅ USAR ESTADO MAPEADO
          statusColor: clickupTask.status.color,
          priority: clickupTask.priority?.priority || 'normal',
          priorityColor: clickupTask.priority?.color || '#6366f1',
          assignees: clickupTask.assignees.map((assignee: any) => ({
            id: assignee.id.toString(),
            name: assignee.username,
            email: assignee.email,
            initials: assignee.initials,
            color: assignee.color
          })),
          dueDate: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)).toISOString() : null,
          startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)).toISOString() : null,
          timeEstimate: clickupTask.time_estimate,
          timeSpent: clickupTask.time_spent,
          points: clickupTask.points,
          tags: clickupTask.tags.map((tag: any) => tag.name),
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
          existsInLocal: existsByQuery,
          canSync: !existsByQuery,
        };
      });

    const existingCount = clickupTasksWithSyncStatus.filter(t => t.existsInLocal).length;
    const newCount = clickupTasksWithSyncStatus.filter(t => t.canSync).length;

    console.log(`📈 Estadísticas de sincronización:`);
    console.log(`   - Ya existen en local: ${existingCount}`);
    console.log(`   - Nuevas por sincronizar: ${newCount}`);

    return NextResponse.json({
      clickupTasks: clickupTasksWithSyncStatus,
      localTasks: localTasks,
      statistics: {
        totalClickUpTasks: allTasks.length,
        existingInLocal: existingCount,
        availableToSync: newCount,
        totalLocalTasks: localTasks.length
      },
      spaces: allSpaces.map(space => ({
        id: space.id,
        name: space.name,
        private: space.private,
        taskCount: clickupTasksWithSyncStatus.filter(t => t.space.id === space.id).length
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo tareas de ClickUp:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener tareas de ClickUp',
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

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    const { 
      taskIds, 
      categoryId, 
      brandId 
    }: { 
      taskIds: string[]; 
      categoryId?: number; 
      brandId: string; 
    } = await req.json();

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({
        error: 'Se requiere un array de taskIds para sincronizar'
      }, { status: 400 });
    }

    if (!brandId) {
      return NextResponse.json({
        error: 'brandId es requerido'
      }, { status: 400 });
    }

    console.log(`🔄 Sincronizando ${taskIds.length} tareas con fechas consecutivas...`);

    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return NextResponse.json({
        error: 'Brand no encontrado'
      }, { status: 404 });
    }

    // Obtener información detallada de cada tarea desde ClickUp
    const tasksData: any[] = [];
    const notFoundTasks: string[] = [];

    for (const taskId of taskIds) {
      try {
        console.log(`   Obteniendo datos de tarea ${taskId}...`);
        
        const taskResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        // ✅ FILTRAR POR ESTADO ANTES DE AGREGAR
        const mappedStatus = mapClickUpStatusToLocal(taskResponse.data.status?.status || '');
        if (mappedStatus === 'TO_DO' || mappedStatus === 'IN_PROGRESS') {
          tasksData.push(taskResponse.data);
          console.log(`   ✅ Datos obtenidos para tarea: ${taskResponse.data.name} (Estado: ${mappedStatus})`);
        } else {
          console.log(`   ⚠️ Tarea ${taskId} omitida por estado: ${mappedStatus}`);
          notFoundTasks.push(taskId);
        }
        
      } catch (error) {
        console.warn(`   ⚠️ Tarea ${taskId} no encontrada o error al obtener datos`);
        notFoundTasks.push(taskId);
      }
    }

    if (tasksData.length === 0) {
      return NextResponse.json({
        error: 'No se encontró información de ninguna tarea válida en ClickUp',
        notFoundTasks: notFoundTasks
      }, { status: 400 });
    }

    // Verificar que las tareas no existan ya
    const existingTasks = await prisma.task.findMany({
      where: {
        OR: [
          { id: { in: tasksData.map(t => t.id) } },
          { url: { in: tasksData.map(t => t.url) } }
        ]
      },
      select: { id: true, name: true, url: true }
    });

    if (existingTasks.length > 0) {
      const existingInfo = existingTasks.map(t => `${t.name} (ID: ${t.id})`);
      console.warn(`⚠️ Tareas ya existentes omitidas: ${existingInfo.join(', ')}`);
    }

    const existingIds = new Set(existingTasks.map(t => t.id));
    const existingUrls = new Set(existingTasks.map(t => t.url));
    const newTasksData = tasksData.filter(task => 
      !existingIds.has(task.id) && !existingUrls.has(task.url)
    );

    if (newTasksData.length === 0) {
      return NextResponse.json({
        message: 'Todas las tareas seleccionadas ya existen en la base de datos',
        skippedTasks: existingTasks
      });
    }

    // ✅ PASO CRÍTICO: Ordenar tareas por fecha de inicio antes de crear
    newTasksData.sort((a, b) => {
      const dateA = a.start_date ? parseInt(a.start_date) : Date.now();
      const dateB = b.start_date ? parseInt(b.start_date) : Date.now();
      return dateA - dateB;
    });

    console.log(`📅 Tareas ordenadas por fecha de inicio:`);
    newTasksData.forEach((task, index) => {
      const startDate = task.start_date ? new Date(parseInt(task.start_date)).toISOString() : 'Sin fecha';
      console.log(`   ${index + 1}. "${task.name}": ${startDate}`);
    });

    const createdTasks = [];
    const errors = [];
    
    for (const clickupTask of newTasksData) {
      try {
        console.log(`   Creando tarea: ${clickupTask.name}`);

        const taskId = clickupTask.id;
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');

        // ✅ USAR FECHAS ORIGINALES DE CLICKUP SI EXISTEN
        const startDate = clickupTask.start_date 
          ? new Date(parseInt(clickupTask.start_date))
          : new Date();
        
        const deadline = clickupTask.due_date 
          ? new Date(parseInt(clickupTask.due_date))
          : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        // ✅ CALCULAR QUEUE POSITION BASADO EN FECHAS PARA CADA ASSIGNEE
        let calculatedQueuePosition = 1;
        
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          // Usar el primer assignee para calcular la posición
          const firstAssigneeId = clickupTask.assignees[0].id.toString();
          calculatedQueuePosition = await calculateProperQueuePosition(
            firstAssigneeId,
            startDate,
            deadline,
            categoryId ? (await prisma.taskCategory.findUnique({ where: { id: categoryId }, include: { type: true } }))?.typeId || 1 : 1
          );
        }

        const newTask = await prisma.task.create({
          data: {
            id: taskId,
            name: clickupTask.name,
            description: clickupTask.description || clickupTask.text_content || '',
            status: mappedStatus, // ✅ USAR ESTADO MAPEADO CORRECTO
            priority: mapClickUpPriority(clickupTask.priority?.priority),
            startDate: startDate, // ✅ USAR FECHA ORIGINAL
            deadline: deadline, // ✅ USAR FECHA ORIGINAL
            timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null,
            points: clickupTask.points,
            tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
            url: clickupTask.url,
            queuePosition: calculatedQueuePosition, // ✅ USAR POSICIÓN CALCULADA
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
            brand: true
          }
        });

        // Crear asignaciones
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
                    taskId: taskId
                  }
                });
                
                // ✅ REORDENAR POSICIONES DESPUÉS DE CADA ASIGNACIÓN
                await reorderQueuePositions(assigneeId, newTask.typeId, taskId);
                
                console.log(`   ✅ Usuario ${assignee.username} asignado y cola reordenada`);
              } catch (assignError) {
                console.warn(`   ⚠️ Error asignando usuario ${assignee.username}:`, assignError);
              }
            } else {
              console.warn(`   ⚠️ Usuario ${assigneeId} no existe en DB local`);
            }
          }
        }

        createdTasks.push(newTask);
        console.log(`✅ Tarea creada con fechas originales: ${newTask.name}`);
        console.log(`   📅 Start: ${startDate.toISOString()}`);
        console.log(`   📅 Deadline: ${deadline.toISOString()}`);
        console.log(`   📍 Queue Position: ${calculatedQueuePosition}`);

      } catch (createError) {
        const errorMsg = `Error creando tarea ${clickupTask.name}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Sincronización completada: ${createdTasks.length} tareas creadas con fechas consecutivas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas sincronizadas exitosamente con fechas consecutivas`,
      createdTasks: createdTasks,
      skippedTasks: existingTasks,
      notFoundTasks: notFoundTasks.length > 0 ? notFoundTasks : undefined,
      errors: errors.length > 0 ? errors : undefined,
      statistics: {
        requested: taskIds.length,
        foundInClickUp: tasksData.length,
        notFoundInClickUp: notFoundTasks.length,
        alreadyExisting: existingTasks.length,
        created: createdTasks.length,
        errors: errors.length
      }
    });

  } catch (error) {
    console.error('❌ Error en sincronización de tareas:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor durante la sincronización',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

function mapClickUpPriority(clickupPriority?: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  if (!clickupPriority) return 'NORMAL';
  
  const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
    'urgent': 'URGENT',
    'high': 'HIGH',
    'normal': 'NORMAL',
    'low': 'LOW'
  };
  
  return priorityMap[clickupPriority.toLowerCase()] || 'NORMAL';
}