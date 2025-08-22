/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-tasks/route.ts - INCLUYENDO TAREAS DONE

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';
import { mapClickUpStatusToLocal } from '@/utils/clickup-task-mapping-utils';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

export async function GET() {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  try {
    console.log('🔍 === OBTENIENDO TAREAS DE CLICKUP (INCLUYENDO DONE) ===');

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
                include_closed: true, // ✅ CAMBIO: Incluir tareas cerradas/done
              }
            }
          );

          const tasks = tasksResponse.data.tasks || [];
          
          // ✅ CAMBIO: Incluir tareas DONE en el filtro
          const filteredTasks = tasks.filter((task: any) => {
            const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
            
            // ✅ NUEVO: Incluir TO_DO, IN_PROGRESS, ON_APPROVAL y COMPLETE
            const hasValidStatus = ['TO_DO', 'IN_PROGRESS', 'ON_APPROVAL', 'COMPLETE'].includes(mappedStatus);
            
            const hasStartDate = task.start_date && task.start_date !== null;
            const hasDueDate = task.due_date && task.due_date !== null;
            
            // ✅ CAMBIO: Para tareas COMPLETE, no requerir fechas (pueden no tenerlas)
            if (mappedStatus === 'COMPLETE') {
              console.log(`       ✅ Tarea COMPLETE incluida: "${task.name}" (estado: ${task.status?.status})`);
              return true;
            }
            
            // Para otras tareas, seguir requiriendo fechas
            if (hasValidStatus && hasStartDate && hasDueDate) {
              return true;
            }
            
            // Log de exclusión para debugging
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
          
          console.log(`         Página ${page}: ${tasks.length} tareas totales, ${filteredTasks.length} con estados válidos (incluyendo DONE)`);
          
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

    console.log(`🎯 Total de tareas con estados válidos (incluyendo DONE): ${allTasks.length}`);

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
        
        // ✅ MEJORAR: Información sobre fechas para tareas DONE
        let startDate = null;
        let dueDate = null;
        
        if (clickupTask.start_date) {
          startDate = new Date(parseInt(clickupTask.start_date)).toISOString();
        }
        
        if (clickupTask.due_date) {
          dueDate = new Date(parseInt(clickupTask.due_date)).toISOString();
        }
        
        // Para tareas COMPLETE sin fechas, usar fechas por defecto o las de creación
        if (mappedStatus === 'COMPLETE' && (!startDate || !dueDate)) {
          if (clickupTask.date_created) {
            const createdDate = new Date(parseInt(clickupTask.date_created));
            if (!startDate) startDate = createdDate.toISOString();
            if (!dueDate) {
              // Para tareas completadas sin due_date, usar la fecha de creación + 1 día como default
              const defaultDue = new Date(createdDate);
              defaultDue.setDate(defaultDue.getDate() + 1);
              dueDate = defaultDue.toISOString();
            }
          }
        }
        
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
          dueDate: dueDate,
          startDate: startDate,
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
          // ✅ NUEVO: Indicador de tarea completada
          isCompleted: mappedStatus === 'COMPLETE',
        };
      });

    const existingCount = clickupTasksWithSyncStatus.filter(t => t.existsInLocal).length;
    const newCount = clickupTasksWithSyncStatus.filter(t => t.canSync).length;
    const completedCount = clickupTasksWithSyncStatus.filter(t => t.isCompleted).length;

    console.log(`📈 Estadísticas de sincronización (INCLUYENDO DONE):`);
    console.log(`   - Ya existen en local: ${existingCount}`);
    console.log(`   - Nuevas por sincronizar: ${newCount}`);
    console.log(`   - Tareas completadas (DONE): ${completedCount}`);

    return NextResponse.json({
      clickupTasks: clickupTasksWithSyncStatus,
      localTasks: localTasks,
      statistics: {
        totalClickUpTasks: allTasks.length,
        existingInLocal: existingCount,
        availableToSync: newCount,
        totalLocalTasks: localTasks.length,
        completedTasks: completedCount, // ✅ NUEVO: Estadística de tareas completadas
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

    console.log(`🔄 === SINCRONIZANDO ${taskIds.length} TAREAS (INCLUYENDO DONE) ===`);
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
        const mappedStatus = mapClickUpStatusToLocal(task.status?.status || '');
        
        // ✅ CAMBIO: Incluir tareas COMPLETE en la sincronización
        if (['TO_DO', 'IN_PROGRESS', 'ON_APPROVAL', 'COMPLETE'].includes(mappedStatus)) {
          tasksData.push(task);
          console.log(`   ✅ Tarea válida: ${task.name} (${mappedStatus})`);
          
          // ✅ Log especial para tareas DONE
          if (mappedStatus === 'COMPLETE') {
            console.log(`   🎯 Tarea COMPLETADA incluida: "${task.name}"`);
            if (task.date_closed) {
              console.log(`      📅 Cerrada el: ${new Date(parseInt(task.date_closed)).toISOString()}`);
            }
          }
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
      select: { id: true, name: true, url: true, status: true }
    });

    if (existingTasks.length > 0) {
      const existingInfo = existingTasks.map(t => `${t.name} (ID: ${t.id}, Status: ${t.status})`);
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

    // ✅ SEPARAR: Tareas completadas vs tareas activas para diferentes tratamientos
    const activeTasks = newTasksData.filter(task => {
      const status = mapClickUpStatusToLocal(task.status?.status || '');
      return status !== 'COMPLETE';
    });

    const completedTasks = newTasksData.filter(task => {
      const status = mapClickUpStatusToLocal(task.status?.status || '');
      return status === 'COMPLETE';
    });

    console.log(`📊 Tareas a sincronizar:`);
    console.log(`   - Activas: ${activeTasks.length}`);
    console.log(`   - Completadas: ${completedTasks.length}`);

    const createdTasks = [];
    const errors = [];
    
    // Procesar todas las tareas (activas y completadas)
    for (const clickupTask of newTasksData) {
      try {
        console.log(`\n🔄 === PROCESANDO: "${clickupTask.name}" ===`);

        const taskId = clickupTask.id;
        const mappedStatus = mapClickUpStatusToLocal(clickupTask.status?.status || '');

        // ✅ FECHAS ESPECIALES para tareas COMPLETE
        let startDate: Date;
        let deadline: Date;

        if (mappedStatus === 'COMPLETE') {
          console.log(`   🎯 Procesando tarea COMPLETADA`);
          
          // Para tareas completadas, usar fechas de ClickUp si están disponibles
          if (clickupTask.start_date && clickupTask.due_date) {
            startDate = new Date(parseInt(clickupTask.start_date));
            deadline = new Date(parseInt(clickupTask.due_date));
          } else {
            // Si no tienen fechas, usar fecha de creación como base
            const createdDate = new Date(parseInt(clickupTask.date_created));
            startDate = createdDate;
            deadline = new Date(createdDate);
            deadline.setDate(deadline.getDate() + 1); // +1 día como default
            
            console.log(`   ⚠️ Tarea DONE sin fechas, usando fecha de creación como base`);
          }
          
          console.log(`   📅 Fechas para tarea DONE:`);
          console.log(`     Start: ${startDate.toISOString()}`);
          console.log(`     Deadline: ${deadline.toISOString()}`);
        } else {
          // Para tareas activas, requerir fechas válidas
          if (!clickupTask.start_date || !clickupTask.due_date) {
            console.log(`   ❌ Tarea activa sin fechas válidas, saltando`);
            errors.push(`Tarea activa ${clickupTask.name} sin fechas válidas`);
            continue;
          }
          
          startDate = new Date(parseInt(clickupTask.start_date));
          deadline = new Date(parseInt(clickupTask.due_date));
        }

        // ✅ CREAR TAREA (incluyendo COMPLETE)
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
            typeId: finalTypeId,
            categoryId: finalCategoryId || 1,
            brandId: brandId,
            lastSyncAt: new Date(),
            syncStatus: 'SYNCED',
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
        console.log(`     Status: ${newTask.status}`);
        console.log(`     Type ID: ${newTask.typeId}`);
        console.log(`     Brand ID: ${newTask.brandId}`);

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

    console.log(`\n🎉 === SINCRONIZACIÓN COMPLETADA (INCLUYENDO DONE) ===`);
    console.log(`✅ ${createdTasks.length} tareas creadas exitosamente`);
    console.log(`   - Activas: ${createdTasks.filter(t => t.status !== 'COMPLETE').length}`);
    console.log(`   - Completadas: ${createdTasks.filter(t => t.status === 'COMPLETE').length}`);
    console.log(`⚠️ ${errors.length} errores`);
    console.log(`🚫 ${notFoundTasks.length} tareas omitidas`);

    return NextResponse.json({
      message: `${createdTasks.length} tareas sincronizadas exitosamente (incluyendo tareas DONE)`,
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
        createdActive: createdTasks.filter(t => t.status !== 'COMPLETE').length,
        createdCompleted: createdTasks.filter(t => t.status === 'COMPLETE').length,
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