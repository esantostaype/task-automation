/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts - VERSIÓN CORREGIDA CON FILTROS Y QUEUE POSITION CORRECTO

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

// ✅ FUNCIÓN MEJORADA: Calcular posición basada en TODAS las tareas del usuario para ese brand
async function calculateProperQueuePositionForSync(
  userId: string, 
  startDate: Date, 
  deadline: Date,
  brandId: string // ✅ AGREGAR brandId para filtrar correctamente
): Promise<number> {
  console.log(`🔍 Calculando posición para usuario ${userId} en brand ${brandId}`);
  
  // ✅ CRÍTICO: Obtener TODAS las tareas del usuario para este brand, SIN filtrar por typeId
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId, // ✅ Filtrar por brand, no por tipo
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { 
      id: true, 
      startDate: true, 
      deadline: true, 
      queuePosition: true,
      name: true,
      typeId: true
    }
  });

  console.log(`   📊 Tareas existentes del usuario en brand ${brandId}: ${userTasks.length}`);
  userTasks.forEach(task => {
    console.log(`     - "${task.name}": ${task.startDate.toISOString()} (pos: ${task.queuePosition}, type: ${task.typeId})`);
  });

  // Si no hay tareas, es la primera
  if (userTasks.length === 0) {
    console.log(`   ✅ Primera tarea del usuario, posición: 1`);
    return 1;
  }

  // Encontrar la posición correcta basada en la fecha de inicio
  let insertPosition = 1;
  
  for (let i = 0; i < userTasks.length; i++) {
    const existingTask = userTasks[i];
    
    // Si la nueva tarea debe ir antes que esta tarea existente
    if (startDate < existingTask.startDate) {
      insertPosition = i + 1;
      console.log(`   📍 Insertando antes de "${existingTask.name}", posición: ${insertPosition}`);
      break;
    }
    
    // Si llegamos al final, va después de todas
    if (i === userTasks.length - 1) {
      insertPosition = userTasks.length + 1;
      console.log(`   📍 Insertando al final, posición: ${insertPosition}`);
    }
  }

  return insertPosition;
}

// ✅ FUNCIÓN MEJORADA: Reordenar considerando brand
async function reorderQueuePositionsForSync(
  userId: string, 
  brandId: string,
  newTaskId: string
): Promise<void> {
  console.log(`🔄 Reordenando posiciones de cola para usuario ${userId}, brand ${brandId}`);
  
  // ✅ OBTENER TODAS las tareas del usuario para este brand
  const userTasks = await prisma.task.findMany({
    where: {
      assignees: { some: { userId } },
      brandId: brandId, // ✅ Filtrar por brand, no por tipo
      status: { notIn: ['COMPLETE'] }
    },
    orderBy: { startDate: 'asc' },
    select: { id: true, queuePosition: true, startDate: true, name: true, typeId: true }
  });

  console.log(`   📊 Reordenando ${userTasks.length} tareas totales para brand ${brandId}`);

  // Actualizar las posiciones secuencialmente
  for (let i = 0; i < userTasks.length; i++) {
    const correctPosition = i + 1;
    const task = userTasks[i];
    
    if (task.queuePosition !== correctPosition) {
      await prisma.task.update({
        where: { id: task.id },
        data: { queuePosition: correctPosition }
      });
      
      console.log(`  ✅ Tarea "${task.name}" (type:${task.typeId}): posición ${task.queuePosition} → ${correctPosition}`);
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
    console.log('🔍 Obteniendo tareas de ClickUp con filtros de fechas...');

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
          
          // ✅ FILTROS MEJORADOS: Estado + Fechas requeridas
          const filteredTasks = tasks.filter((task: any) => {
            const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
            const hasValidStatus = mappedStatus === 'TO_DO' || mappedStatus === 'IN_PROGRESS';
            
            // ✅ NUEVO: Filtrar tareas que tengan tanto startDate como dueDate
            const hasStartDate = task.start_date && task.start_date !== null;
            const hasDueDate = task.due_date && task.due_date !== null;
            
            if (hasValidStatus && hasStartDate && hasDueDate) {
              return true;
            }
            
            // Log de por qué se excluye la tarea
            if (!hasValidStatus) {
              console.log(`       🚫 Tarea "${task.name}" excluida por estado: ${task.status?.status} → ${mappedStatus}`);
            } else if (!hasStartDate) {
              console.log(`       🚫 Tarea "${task.name}" excluida: sin startDate`);
            } else if (!hasDueDate) {
              console.log(`       🚫 Tarea "${task.name}" excluida: sin dueDate`);
            }
            
            return false;
          });
          
          tasksArray.push(...filteredTasks);
          
          console.log(`         Página ${page}: ${tasks.length} tareas totales, ${filteredTasks.length} con fechas válidas`);
          
          hasMorePages = tasks.length > 0 && tasks.length >= 100;
          page++;
        }
        
      } catch (taskError: any) {
        console.warn(`       ⚠️ Error obteniendo tareas de la lista ${list.name}:`, taskError.response?.status || taskError.message);
      }
    }

    console.log(`🎯 Total de tareas con fechas válidas en ClickUp: ${allTasks.length}`);

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
          // ✅ MOSTRAR las fechas que SÍ existen
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

    console.log(`📈 Estadísticas de sincronización (solo tareas con fechas):`);
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

    console.log(`🔄 === SINCRONIZANDO ${taskIds.length} TAREAS CON QUEUE POSITION CORRECTO ===`);
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

    // ✅ DETERMINAR CATEGORY/TYPE POR DEFECTO SI NO SE PROPORCIONA
    let finalCategoryId = categoryId;
    let finalTypeId = 1; // default

    if (!categoryId) {
      // Buscar una categoría "Miscellaneous" o crear una por defecto
      let defaultCategory = await prisma.taskCategory.findFirst({
        where: { 
          name: 'Miscellaneous',
          type: { name: 'General Design' }
        },
        include: { type: true }
      });

      if (!defaultCategory) {
        // Crear tipo y categoría por defecto si no existen
        let defaultType = await prisma.taskType.findFirst({
          where: { name: 'General Design' }
        });

        if (!defaultType) {
          defaultType = await prisma.taskType.create({
            data: { name: 'General Design' }
          });
        }

        // Buscar tier D por defecto
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

    // Obtener información detallada de cada tarea desde ClickUp
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
        
        // ✅ VERIFICAR QUE TENGA FECHAS ANTES DE PROCESAR
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
        error: 'No se encontró información de ninguna tarea válida con fechas en ClickUp',
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

    // ✅ Ordenar tareas por fecha de inicio
    newTasksData.sort((a, b) => {
      const dateA = parseInt(a.start_date);
      const dateB = parseInt(b.start_date);
      return dateA - dateB;
    });

    console.log(`📅 === PROCESANDO ${newTasksData.length} TAREAS ORDENADAS ===`);

    const createdTasks = [];
    const errors = [];
    
    for (const clickupTask of newTasksData) {
      try {
        console.log(`\n🔄 === PROCESANDO: "${clickupTask.name}" ===`);

        const taskId = clickupTask.id;
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');

        // ✅ USAR FECHAS ORIGINALES DE CLICKUP
        const startDate = new Date(parseInt(clickupTask.start_date));
        const deadline = new Date(parseInt(clickupTask.due_date));
        
        console.log(`   📅 Fechas originales de ClickUp:`);
        console.log(`     Start: ${startDate.toISOString()}`);
        console.log(`     Due: ${deadline.toISOString()}`);

        // ✅ CALCULAR QUEUE POSITION BASADO EN EL BRAND, NO EN EL TIPO
        let calculatedQueuePosition = 1;
        
        if (clickupTask.assignees && clickupTask.assignees.length > 0) {
          const firstAssigneeId = clickupTask.assignees[0].id.toString();
          
          calculatedQueuePosition = await calculateProperQueuePositionForSync(
            firstAssigneeId,
            startDate,
            deadline,
            brandId // ✅ USAR BRAND ID para calcular posición
          );
          
          console.log(`   📍 Posición calculada para usuario ${firstAssigneeId}: ${calculatedQueuePosition}`);
        }

        // ✅ CREAR TAREA CON DATOS CORRECTOS
        const newTask = await prisma.task.create({
          data: {
            id: taskId,
            name: clickupTask.name,
            description: clickupTask.description || clickupTask.text_content || '',
            status: mappedStatus,
            priority: mapClickUpPriority(clickupTask.priority?.priority),
            startDate: startDate, // ✅ Fechas originales de ClickUp
            deadline: deadline,   // ✅ Fechas originales de ClickUp
            timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null,
            points: clickupTask.points,
            tags: clickupTask.tags?.map((t: any) => t.name).join(', ') || null,
            url: clickupTask.url,
            queuePosition: calculatedQueuePosition, // ✅ Posición basada en fechas reales
            typeId: finalTypeId,     // ✅ Tipo correcto
            categoryId: finalCategoryId || 1, // ✅ Categoría correcta
            brandId: brandId,        // ✅ Brand correcto
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
        console.log(`     Queue Position: ${newTask.queuePosition}`);
        console.log(`     Type ID: ${newTask.typeId}`);
        console.log(`     Brand ID: ${newTask.brandId}`);

        // ✅ CREAR ASIGNACIONES Y REORDENAR COLA
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
                
                // ✅ REORDENAR BASADO EN BRAND, NO EN TIPO
                await reorderQueuePositionsForSync(assigneeId, brandId, taskId);
                
                console.log(`   ✅ Usuario ${assignee.username} asignado y cola reordenada por brand`);
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

    console.log(`\n🎉 === SINCRONIZACIÓN COMPLETADA ===`);
    console.log(`✅ ${createdTasks.length} tareas creadas exitosamente`);
    console.log(`⚠️ ${errors.length} errores`);
    console.log(`🚫 ${notFoundTasks.length} tareas omitidas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas sincronizadas exitosamente con queue positions correctos`,
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