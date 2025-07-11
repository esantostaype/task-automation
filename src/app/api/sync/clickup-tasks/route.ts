/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

interface ClickUpAssignee {
  id: number;
  username: string;
  email: string;
  color: string;
  initials: string;
  profilePicture: string;
}

interface ClickUpTask {
  id: string;
  custom_id: string | null;
  name: string;
  text_content: string;
  description: string;
  status: {
    id: string;
    status: string;
    color: string;
    type: string;
    orderindex: number;
  };
  orderindex: string;
  date_created: string;
  date_updated: string;
  date_closed: string | null;
  date_done: string | null;
  assignees: ClickUpAssignee[];
  watchers: ClickUpAssignee[];
  checklists: any[];
  tags: Array<{
    name: string;
    tag_fg: string;
    tag_bg: string;
  }>;
  parent: string | null;
  priority: {
    id: string;
    priority: string;
    color: string;
    orderindex: string;
  } | null;
  due_date: string | null;
  start_date: string | null;
  points: number | null;
  time_estimate: number | null;
  time_spent: number | null;
  list: {
    id: string;
    name: string;
    access: boolean;
  };
  folder: {
    id: string;
    name: string;
    hidden: boolean;
    access: boolean;
  };
  space: {
    id: string;
    name: string;
  };
  url: string;
}

/**
 * GET /api/sync/clickup-tasks
 * Obtiene todas las tareas de ClickUp y las compara con las tareas locales
 */
export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 Obteniendo tareas de ClickUp...');

    // Obtener teams primero
    const teamsResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    // Obtener todos los spaces de los teams
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

    // Obtener todas las tareas de todos los spaces usando el enfoque correcto:
    // Space -> Folders -> Lists -> Tasks
    const allTasks: ClickUpTask[] = [];
    
    for (const space of allSpaces) {
      try {
        console.log(`   Obteniendo folders del space: ${space.name}`);
        
        // Obtener folders del space
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
        console.log(`     Folders encontrados: ${folders.length}`);

        // También obtener listas que están directamente en el space (sin folder)
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
          console.log(`     Listas directas del space: ${spaceLists.length}`);

          // Obtener tareas de las listas directas del space
          for (const list of spaceLists) {
            await getTasksFromList(list, allTasks);
          }
        } catch (spaceListError) {
          if (spaceListError && typeof spaceListError === 'object' && 'response' in spaceListError) {
            console.warn(`     ⚠️ Error obteniendo listas directas del space ${space.name}:`, (spaceListError as any).response?.status);
          } else {
            console.warn(`     ⚠️ Error obteniendo listas directas del space ${space.name}:`, spaceListError);
          }
        }

        // Obtener listas de cada folder
        for (const folder of folders) {
          try {
            console.log(`     Obteniendo listas del folder: ${folder.name}`);
            
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
            console.log(`       Listas encontradas: ${lists.length}`);

            // Obtener tareas de cada lista
            for (const list of lists) {
              await getTasksFromList(list, allTasks);
            }

          } catch (folderError) {
            if (folderError && typeof folderError === 'object' && 'response' in folderError) {
              console.warn(`     ⚠️ Error obteniendo listas del folder ${folder.name}:`, (folderError as any).response?.status);
            } else {
              console.warn(`     ⚠️ Error obteniendo listas del folder ${folder.name}:`, folderError);
            }
          }
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Error obteniendo contenido del space ${space.name}:`, error.response?.status || error.message);
      }
    }

    // Función auxiliar para obtener tareas de una lista
    async function getTasksFromList(list: any, tasksArray: ClickUpTask[]) {
      try {
        console.log(`       Obteniendo tareas de la lista: ${list.name}`);
        
        let page = 0;
        let hasMorePages = true;
        
        while (hasMorePages && page < 5) { // Límite de páginas por lista
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
          tasksArray.push(...tasks);
          
          console.log(`         Página ${page}: ${tasks.length} tareas`);
          
          // Verificar si hay más páginas (ClickUp no siempre envía last_page)
          hasMorePages = tasks.length > 0 && tasks.length >= 100; // 100 es el límite por página
          page++;
        }
        
      } catch (taskError: any) {
        console.warn(`       ⚠️ Error obteniendo tareas de la lista ${list.name}:`, taskError.response?.status || taskError.message);
      }
    }

    console.log(`🎯 Total de tareas encontradas en ClickUp: ${allTasks.length}`);

    // Obtener tareas existentes en la DB local que coincidan con IDs o URLs de ClickUp
    const localTasks = await prisma.task.findMany({
      select: { 
        id: true, 
        name: true, 
        status: true, 
        url: true
      }
    });

    console.log(`💾 Tareas en DB local: ${localTasks.length}`);

    // Crear mapas para comparación rápida por ID y URL
    const localTaskIds = new Set(localTasks.map(task => task.id));
    const localTaskUrls = new Set(localTasks.map(task => task.url).filter(Boolean));

    // Mapear tareas de ClickUp con información de sincronización
    const clickupTasksWithSyncStatus = allTasks
      .filter(clickupTask => {
        if (!clickupTask.id || !clickupTask.name) {
          console.warn(`⚠️ Tarea sin ID/nombre omitida:`, clickupTask.id);
          return false;
        }
        return true;
      })
      .map(clickupTask => {
        const taskId = clickupTask.id;
        const taskUrl = clickupTask.url;
        
        // Verificar si existe por ID o por URL
        const existsByQuery = localTaskIds.has(taskId) || localTaskUrls.has(taskUrl);
        
        return {
          clickupId: taskId,
          customId: clickupTask.custom_id,
          name: clickupTask.name,
          description: clickupTask.description || clickupTask.text_content || '',
          status: clickupTask.status.status,
          statusColor: clickupTask.status.color,
          priority: clickupTask.priority?.priority || 'normal',
          priorityColor: clickupTask.priority?.color || '#6366f1',
          assignees: clickupTask.assignees.map(assignee => ({
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
          tags: clickupTask.tags.map(tag => tag.name),
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
          // Estado de sincronización basado en ID o URL
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

/**
 * POST /api/sync/clickup-tasks
 * Sincroniza tareas seleccionadas de ClickUp a la base de datos local
 */
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

    console.log(`🔄 Sincronizando ${taskIds.length} tareas...`);

    // Verificar que el brand existe
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

        tasksData.push(taskResponse.data);
        console.log(`   ✅ Datos obtenidos para tarea: ${taskResponse.data.name}`);
        
      } catch (error) {
        console.warn(`   ⚠️ Tarea ${taskId} no encontrada o error al obtener datos`);
        notFoundTasks.push(taskId);
      }
    }

    if (tasksData.length === 0) {
      return NextResponse.json({
        error: 'No se encontró información de ninguna tarea en ClickUp',
        notFoundTasks: notFoundTasks
      }, { status: 400 });
    }

    // Verificar que las tareas no existan ya (por ID o URL)
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

    // Filtrar tareas nuevas (que no existan por ID ni por URL)
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

    // Obtener la posición máxima actual para el queue
    const maxPosition = await prisma.task.aggregate({
      _max: { queuePosition: true }
    });
    let nextPosition = (maxPosition._max.queuePosition || 0) + 1;

    // Crear tareas en la base de datos local
    const createdTasks = [];
    const errors = [];
    
    for (const clickupTask of newTasksData) {
      try {
        console.log(`   Creando tarea: ${clickupTask.name}`);

        // Usar el ID de ClickUp directamente como ID de la tarea
        const taskId = clickupTask.id;

        // Verificar que no exista ya una tarea con este ID
        const existingTaskById = await prisma.task.findUnique({
          where: { id: taskId }
        });

        if (existingTaskById) {
          console.warn(`   ⚠️ Tarea con ID ${taskId} ya existe, omitiendo...`);
          continue;
        }

        const newTask = await prisma.task.create({
          data: {
            id: taskId, // Usar ID de ClickUp directamente
            name: clickupTask.name,
            description: clickupTask.description || clickupTask.text_content || '',
            status: mapClickUpStatus(clickupTask.status.status),
            priority: mapClickUpPriority(clickupTask.priority?.priority),
            startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : new Date(),
            deadline: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días por defecto
            timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null, // Convert ms to hours
            points: clickupTask.points,
            tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
            url: clickupTask.url,
            queuePosition: nextPosition++,
            typeId: categoryId ? (await prisma.taskCategory.findUnique({ where: { id: categoryId }, include: { type: true } }))?.typeId || 1 : 1,
            categoryId: categoryId || 1, // Usar categoría proporcionada o default
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

        // Crear asignaciones si hay assignees válidos
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          for (const assignee of clickupTask.assignees) {
            const assigneeId = assignee.id.toString();
            
            // Verificar que el usuario existe en nuestra DB
            const userExists = await prisma.user.findUnique({
              where: { id: assigneeId }
            });
            
            if (userExists) {
              try {
                await prisma.taskAssignment.create({
                  data: {
                    userId: assigneeId,
                    taskId: taskId // Usar el ID de ClickUp
                  }
                });
                console.log(`   ✅ Asignado usuario ${assignee.username} a tarea ${clickupTask.name}`);
              } catch (assignError) {
                console.warn(`   ⚠️ Error asignando usuario ${assignee.username}:`, assignError);
              }
            } else {
              console.warn(`   ⚠️ Usuario ${assigneeId} (${assignee.username}) no existe en DB local`);
            }
          }
        }

        createdTasks.push(newTask);
        console.log(`✅ Tarea creada: ${newTask.name} (ID: ${newTask.id})`);

      } catch (createError) {
        const errorMsg = `Error creando tarea ${clickupTask.name}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Sincronización completada: ${createdTasks.length} tareas creadas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas sincronizadas exitosamente`,
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

// Funciones auxiliares para mapear estados y prioridades
function mapClickUpStatus(clickupStatus: string): 'TO_DO' | 'IN_PROGRESS' | 'ON_APPROVAL' | 'COMPLETE' {
  const statusMap: Record<string, 'TO_DO' | 'IN_PROGRESS' | 'ON_APPROVAL' | 'COMPLETE'> = {
    'to do': 'TO_DO',
    'open': 'TO_DO',
    'in progress': 'IN_PROGRESS',
    'review': 'ON_APPROVAL',
    'done': 'COMPLETE',
    'closed': 'COMPLETE',
    'complete': 'COMPLETE'
  };
  
  return statusMap[clickupStatus.toLowerCase()] || 'TO_DO';
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