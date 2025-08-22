/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts - UPDATED to filter completed tasks

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

// ✅ NUEVA FUNCIÓN: Verificar si un estado es válido (no completado)
function isValidTaskStatus(status: string): boolean {
  const statusLower = status.toLowerCase();
  
  // ✅ EXCLUIR tareas completadas
  if (statusLower.includes('done') || statusLower.includes('complete') ||
      statusLower.includes('finished') || statusLower.includes('closed') ||
      statusLower.includes('resolved') || statusLower.includes('delivered') ||
      statusLower.includes('merged') || statusLower.includes('deployed')) {
    return false;
  }
  
  // ✅ INCLUIR solo tareas activas
  return statusLower.includes('to do') || statusLower.includes('todo') || 
         statusLower.includes('open') || statusLower.includes('backlog') ||
         statusLower.includes('new') || statusLower.includes('pending') ||
         statusLower.includes('ready') || statusLower.includes('in progress') || 
         statusLower.includes('in-progress') || statusLower.includes('progress') || 
         statusLower.includes('active') || statusLower.includes('working') || 
         statusLower.includes('development') || statusLower.includes('doing') ||
         statusLower.includes('review') || statusLower.includes('approval') ||
         statusLower.includes('pending approval') || statusLower.includes('on approval') ||
         statusLower.includes('waiting') || statusLower.includes('qa') || 
         statusLower.includes('testing') || statusLower.includes('check');
}

// ✅ SIMPLIFICADO: Ya no calculamos posiciones, solo validamos fechas
async function validateTaskDatesForSync(
  userId: string, 
  startDate: Date, 
  deadline: Date,
  brandId: string
): Promise<boolean> {
  console.log(`🔍 Validando fechas para usuario ${userId} en brand ${brandId}`);
  
  // Obtener tareas existentes del usuario para referencia
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { 
      id: true, 
      startDate: true, 
      deadline: true,
      name: true,
      typeId: true
    }
  });

  console.log(`   📊 Tareas existentes del usuario en brand ${brandId}: ${userTasks.length}`);
  userTasks.forEach(task => {
    console.log(`     - "${task.name}": ${task.startDate.toISOString()} → ${task.deadline.toISOString()}`);
  });

  // Validar que las fechas sean coherentes
  if (startDate >= deadline) {
    console.log(`   ❌ Fechas inválidas: startDate >= deadline`);
    return false;
  }

  console.log(`   ✅ Fechas válidas: ${startDate.toISOString()} → ${deadline.toISOString()}`);
  return true;
}

// ✅ SIMPLIFICADO: Solo log del estado actual, sin reordenar posiciones
async function logUserTasksAfterSync(
  userId: string, 
  brandId: string,
  newTaskId: string
): Promise<void> {
  console.log(`📊 Estado de tareas para usuario ${userId}, brand ${brandId} después del sync`);
  
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId,
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' }, // ✅ Solo ordenar por fecha
    select: { id: true, startDate: true, deadline: true, name: true, typeId: true }
  });

  console.log(`   📊 Total tareas ordenadas por fecha: ${userTasks.length}`);

  userTasks.forEach((task, index) => {
    const isNew = task.id === newTaskId;
    const prefix = isNew ? '🆕' : '📋';
    console.log(`   ${prefix} ${index + 1}. "${task.name}": ${task.startDate.toISOString()} → ${task.deadline.toISOString()}`);
  });
}

export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 Obteniendo tareas activas de ClickUp (excluyendo completadas)...');

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
                include_closed: false, // ✅ MEJORADO: Excluir tareas cerradas desde ClickUp
              }
            }
          );

          const tasks = tasksResponse.data.tasks || [];
          
          // ✅ FILTROS MEJORADOS: Estado activo + Fechas requeridas + Excluir completadas
          const filteredTasks = tasks.filter((task: any) => {
            const taskStatus = task.status?.status || '';
            
            // ✅ NUEVO: Primero verificar que no esté completada
            if (!isValidTaskStatus(taskStatus)) {
              console.log(`       🚫 Tarea "${task.name}" excluida por estar completada: ${taskStatus}`);
              return false;
            }
            
            const mappedStatus = mapClickUpStatusToLocal(taskStatus);
            const hasValidStatus = mappedStatus === 'TO_DO' || mappedStatus === 'IN_PROGRESS';
            
            const hasStartDate = task.start_date && task.start_date !== null;
            const hasDueDate = task.due_date && task.due_date !== null;
            
            if (hasValidStatus && hasStartDate && hasDueDate) {
              console.log(`       ✅ Tarea válida: "${task.name}" (${taskStatus} → ${mappedStatus})`);
              return true;
            }
            
            // Log de exclusión para tareas activas sin fechas
            if (!hasStartDate) {
              console.log(`       🚫 Tarea "${task.name}" excluida: sin startDate`);
            } else if (!hasDueDate) {
              console.log(`       🚫 Tarea "${task.name}" excluida: sin dueDate`);
            } else if (!hasValidStatus) {
              console.log(`       🚫 Tarea "${task.name}" excluida por estado: ${taskStatus} → ${mappedStatus}`);
            }
            
            return false;
          });
          
          tasksArray.push(...filteredTasks);
          
          console.log(`         Página ${page}: ${tasks.length} tareas totales, ${filteredTasks.length} tareas activas con fechas válidas`);
          
          hasMorePages = tasks.length > 0 && tasks.length >= 100;
          page++;
        }
        
      } catch (taskError: any) {
        console.warn(`       ⚠️ Error obteniendo tareas de la lista ${list.name}:`, taskError.response?.status || taskError.message);
      }
    }

    // Procesar todos los spaces
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

    console.log(`🎯 Total de tareas activas con fechas válidas en ClickUp: ${allTasks.length}`);

    // Obtener tareas existentes en la DB local (solo activas)
    const localTasks = await prisma.task.findMany({
      where: {
        status: { notIn: ['COMPLETE'] } // ✅ MEJORADO: Excluir completadas de DB local también
      },
      select: { 
        id: true, 
        name: true, 
        status: true, 
        url: true
      }
    });

    console.log(`💾 Tareas activas en DB local: ${localTasks.length}`);

    const localTaskIds = new Set(localTasks.map(task => task.id));
    const localTaskUrls = new Set(localTasks.map(task => task.url).filter(Boolean));

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
        
        const existsByQuery = localTaskIds.has(taskId) || localTaskUrls.has(taskUrl);
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');
        
        return {
          clickupId: taskId,
          customId: clickupTask.custom_id,
          name: clickupTask.name,
          description: clickupTask.description || clickupTask.text_content || '',
          status: mappedStatus,
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
          dueDate: new Date(parseInt(clickupTask.due_date)).toISOString(),
          startDate: new Date(parseInt(clickupTask.start_date)).toISOString(),
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

    console.log(`📈 Estadísticas de sincronización (solo tareas activas):`);
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

    console.log(`🔄 === SINCRONIZANDO ${taskIds.length} TAREAS ACTIVAS ===`);
    console.log(`📋 Brand ID: ${brandId}`);
    console.log(`📋 Category ID: ${categoryId || 'default'}`);

    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return NextResponse.json({
        error: 'Brand no encontrado'
      }, { status: 404 });
    }

    // Determinar category/type por defecto
    let finalCategoryId = categoryId;
    let finalTypeId = 1;

    if (!categoryId) {
      let defaultCategory = await prisma.taskCategory.findFirst({
        where: { 
          name: 'Miscellaneous',
          type: { name: 'General Design' }
        },
        include: { type: true }
      });

      if (!defaultCategory) {
        let defaultType = await prisma.taskType.findFirst({
          where: { name: 'General Design' }
        });

        if (!defaultType) {
          defaultType = await prisma.taskType.create({
            data: { name: 'General Design' }
          });
        }

        const defaultTier = await prisma.tierList.findFirst({
          where: { name: 'D' }
        });

        if (defaultTier) {
          defaultCategory = await prisma.taskCategory.create({
            data: {
              name: 'Miscellaneous',
              typeId: defaultType.id,
              tierId: defaultTier.id
            },
            include: { type: true }
          });
        }
      }

      if (defaultCategory) {
        finalCategoryId = defaultCategory.id;
        finalTypeId = defaultCategory.type.id;
        console.log(`✅ Usando categoría por defecto: ${defaultCategory.name} (Type: ${defaultCategory.type.name})`);
      }
    } else {
      const category = await prisma.taskCategory.findUnique({
        where: { id: categoryId },
        include: { type: true }
      });
      if (category) {
        finalTypeId = category.type.id;
        console.log(`✅ Usando categoría especificada: ${category.name} (Type: ${category.type.name})`);
      }
    }

    // Obtener información de tareas desde ClickUp
    const tasksData: any[] = [];
    const notFoundTasks: string[] = [];

    for (const taskId of taskIds) {
      try {
        console.log(`   🔍 Obteniendo datos de tarea ${taskId}...`);
        
        const taskResponse = await axios.get(
          `${API_CONFIG.CLICKUP_API_BASE}/task/${taskId}`,
          {
            headers: {
              'Authorization': CLICKUP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        const task = taskResponse.data;
        
        // ✅ MEJORADO: Verificar que no esté completada
        if (!isValidTaskStatus(task.status?.status || '')) {
          console.log(`   🚫 Tarea ${taskId} omitida: está completada (${task.status?.status})`);
          notFoundTasks.push(taskId);
          continue;
        }
        
        if (!task.start_date || !task.due_date) {
          console.log(`   ⚠️ Tarea ${taskId} omitida: sin startDate o dueDate`);
          notFoundTasks.push(taskId);
          continue;
        }

        const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
        if (mappedStatus === 'TO_DO' || mappedStatus === 'IN_PROGRESS') {
          tasksData.push(task);
          console.log(`   ✅ Tarea válida: ${task.name} (${mappedStatus})`);
        } else {
          console.log(`   ⚠️ Tarea ${taskId} omitida por estado: ${mappedStatus}`);
          notFoundTasks.push(taskId);
        }
        
      } catch (error) {
        console.warn(`   ❌ Tarea ${taskId} no encontrada o error al obtener datos`);
        notFoundTasks.push(taskId);
      }
    }

    if (tasksData.length === 0) {
      return NextResponse.json({
        error: 'No se encontró información de ninguna tarea válida activa con fechas en ClickUp',
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

    // Ordenar por fecha de inicio
    newTasksData.sort((a, b) => {
      const dateA = parseInt(a.start_date);
      const dateB = parseInt(b.start_date);
      return dateA - dateB;
    });

    console.log(`📅 === PROCESANDO ${newTasksData.length} TAREAS ACTIVAS ORDENADAS POR FECHA ===`);

    const createdTasks = [];
    const errors = [];
    
    for (const clickupTask of newTasksData) {
      try {
        console.log(`\n🔄 === PROCESANDO: "${clickupTask.name}" ===`);

        const taskId = clickupTask.id;
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');

        const startDate = new Date(parseInt(clickupTask.start_date));
        const deadline = new Date(parseInt(clickupTask.due_date));
        
        console.log(`   📅 Fechas de ClickUp:`);
        console.log(`     Start: ${startDate.toISOString()}`);
        console.log(`     Due: ${deadline.toISOString()}`);

        // ✅ VALIDAR FECHAS SIN CALCULAR POSICIÓN
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          const firstAssigneeId = clickupTask.assignees[0].id.toString();
          
          const isValid = await validateTaskDatesForSync(
            firstAssigneeId,
            startDate,
            deadline,
            brandId
          );
          
          if (!isValid) {
            console.log(`   ❌ Fechas inválidas para usuario ${firstAssigneeId}`);
            errors.push(`Fechas inválidas para tarea ${clickupTask.name}`);
            continue;
          }
        }

        // ✅ CREAR TAREA SIN queuePosition
        const newTask = await prisma.task.create({
          data: {
            id: taskId,
            name: clickupTask.name,
            description: clickupTask.description || clickupTask.text_content || '',
            status: mappedStatus,
            priority: mapClickUpPriority(clickupTask.priority?.priority),
            startDate: startDate,
            deadline: deadline,
            timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null,
            points: clickupTask.points,
            tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
            url: clickupTask.url,
            // ✅ NO incluir queuePosition
            typeId: finalTypeId,
            categoryId: finalCategoryId || 1,
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

        console.log(`   ✅ Tarea creada en DB:`);
        console.log(`     ID: ${newTask.id}`);
        console.log(`     Type ID: ${newTask.typeId}`);
        console.log(`     Brand ID: ${newTask.brandId}`);
        console.log(`     Fechas: ${newTask.startDate.toISOString()} → ${newTask.deadline.toISOString()}`);

        // ✅ CREAR ASIGNACIONES Y LOG ESTADO
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
                
                // ✅ SOLO LOG, SIN REORDENAR
                await logUserTasksAfterSync(assigneeId, brandId, taskId);
                
                console.log(`   ✅ Usuario ${assignee.username} asignado exitosamente`);
              } catch (assignError) {
                console.warn(`   ⚠️ Error asignando usuario ${assignee.username}:`, assignError);
              }
            } else {
              console.warn(`   ⚠️ Usuario ${assigneeId} no existe en DB local`);
            }
          }
        }

        createdTasks.push(newTask);

      } catch (createError) {
        const errorMsg = `Error creando tarea ${clickupTask.name}: ${createError instanceof Error ? createError.message : 'Error desconocido'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n🎉 === SINCRONIZACIÓN COMPLETADA (SOLO TAREAS ACTIVAS) ===`);
    console.log(`✅ ${createdTasks.length} tareas creadas exitosamente`);
    console.log(`⚠️ ${errors.length} errores`);
    console.log(`🚫 ${notFoundTasks.length} tareas omitidas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas activas sincronizadas exitosamente con fechas ordenadas`,
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