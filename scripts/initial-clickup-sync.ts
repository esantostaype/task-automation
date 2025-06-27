/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/initial-clickup-sync.ts
// Para ejecutar: npx ts-node scripts/initial-clickup-sync.ts
// Asegúrate de tener 'ts-node' instalado: npm install -g ts-node

import { PrismaClient, Status, Priority, Tier } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = 'pk_114240449_Z7E2UHHHWSF14M6T98OZTQUJ9WC83U47'
const CLICKUP_TEAM_ID = '9017044866'; // Tu ID de Workspace/Team en ClickUp

if (!CLICKUP_TOKEN || !CLICKUP_TEAM_ID) {
  console.error('¡ERROR: CLICKUP_API_TOKEN y CLICKUP_TEAM_ID deben estar configurados en .env!');
  process.exit(1);
}

// Mapeo de prioridades de ClickUp a tus enums locales
const clickupPriorityMap: Record<number, Priority> = {
  1: Priority.URGENT,
  2: Priority.HIGH,
  3: Priority.NORMAL,
  4: Priority.LOW,
};

// Define los estados de ClickUp que se consideran "completados" en tu sistema
const CLICKUP_COMPLETE_STATUSES = ['complete', 'closed', 'done'];

// Función para mapear estados de ClickUp a tus enums locales
// Usa el statusMapping del brand si existe, de lo contrario un fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClickUpStatusToLocal(clickupStatus: string, brandStatusMapping: any): Status {
  if (brandStatusMapping && typeof brandStatusMapping === 'object') {
    const mappedStatus = Object.keys(brandStatusMapping).find(
      (key) => brandStatusMapping[key] === clickupStatus
    );
    if (mappedStatus && Object.values(Status).includes(mappedStatus as Status)) {
      return mappedStatus as Status;
    }
  }
  // Fallback si no hay mapeo o no es válido
  switch (clickupStatus.toLowerCase()) {
    case 'to do':
    case 'open':
    case 'new':
      return Status.TO_DO;
    case 'in progress':
    case 'active':
      return Status.IN_PROGRESS;
    case 'on approval':
    case 'review':
      return Status.ON_APPROVAL;
    case 'complete':
    case 'closed':
    case 'done':
      return Status.COMPLETE;
    default:
      return Status.TO_DO; // Estado por defecto si no se encuentra mapeo
  }
}

// Función para inferir TaskType y TaskCategory
// Prioriza tags con formato "type:<value>" y "category:<value>"
// Si no los encuentra, usa la lógica de inferencia por palabras clave.
async function inferTaskTypeAndCategory(taskName: string, clickupTags: string[]): Promise<{ typeId: number; categoryId: number; duration: number; tier: Tier }> {
  let inferredTypeName: string | null = null;
  let inferredCategoryName: string | null = null;
  let inferredDuration: number = 2; // Default days
  let inferredTier: Tier = Tier.C; // Default

  const tagsLower = clickupTags.map(tag => tag.toLowerCase());

  // 1. Priorizar la extracción de Type y Category de los tags
  for (const tag of tagsLower) {
    if (tag.startsWith('type:')) {
      inferredTypeName = tag.substring('type:'.length).trim();
    }
    if (tag.startsWith('category:')) {
      inferredCategoryName = tag.substring('category:'.length).trim();
    }
  }

  // Si no se encontró el tipo o categoría en los tags, usar la lógica de palabras clave (fallback)
  if (!inferredTypeName || !inferredCategoryName) {
    const nameLower = taskName.toLowerCase();

    // Lógica de inferencia por palabras clave (similar a la anterior)
    if (['ux', 'ui', 'user experience', 'user interface'].some(keyword => nameLower.includes(keyword) || tagsLower.includes(keyword))) {
      if (!inferredTypeName) inferredTypeName = 'UX/UI Design';
      if (!inferredCategoryName) {
        if (nameLower.includes('research') || tagsLower.includes('research')) {
          inferredCategoryName = 'UX Research'; inferredDuration = 5; inferredTier = Tier.A;
        } else if (nameLower.includes('wireframe') || tagsLower.includes('wireframe')) {
          inferredCategoryName = 'Wireframing'; inferredDuration = 3; inferredTier = Tier.B;
        } else {
          inferredCategoryName = 'UI Design'; inferredDuration = 4; inferredTier = Tier.B;
        }
      }
    } else if (['graphic', 'branding', 'logo', 'print'].some(keyword => nameLower.includes(keyword) || tagsLower.includes(keyword))) {
      if (!inferredTypeName) inferredTypeName = 'Graphic Design';
      if (!inferredCategoryName) {
        if (nameLower.includes('logo') || tagsLower.includes('logo')) {
          inferredCategoryName = 'Logo Design'; inferredDuration = 7; inferredTier = Tier.S;
        } else if (nameLower.includes('banner') || tagsLower.includes('banner')) {
          inferredCategoryName = 'Banner Design'; inferredDuration = 1; inferredTier = Tier.D;
        } else {
          inferredCategoryName = 'General Graphic'; inferredDuration = 2; inferredTier = Tier.C;
        }
      }
    }
  }

  // Si después de todo, sigue sin haber un tipo/categoría, usar defaults genéricos
  if (!inferredTypeName) inferredTypeName = 'General Design';
  if (!inferredCategoryName) inferredCategoryName = 'Miscellaneous';

  // Busca o crea el TaskType
  let taskType = await prisma.taskType.findUnique({ where: { name: inferredTypeName } });
  if (!taskType) {
    taskType = await prisma.taskType.create({ data: { name: inferredTypeName } });
    console.log(`  -> Creado nuevo TaskType: ${taskType.name}`);
  }

  // Busca o crea la TaskCategory
  let taskCategory = await prisma.taskCategory.findFirst({
    where: { name: inferredCategoryName, typeId: taskType.id },
  });
  if (!taskCategory) {
    taskCategory = await prisma.taskCategory.create({
      data: {
        name: inferredCategoryName,
        duration: inferredDuration, // Se usa la duración inferida o por defecto
        tier: inferredTier,         // Se usa el tier inferido o por defecto
        typeId: taskType.id,
      },
    });
    console.log(`  -> Creada nueva TaskCategory: ${taskCategory.name} (Type: ${taskType.name})`);
  } else {
    // Si la categoría ya existe, usar su duración y tier existentes
    inferredDuration = taskCategory.duration;
    inferredTier = taskCategory.tier;
  }

  return {
    typeId: taskType.id,
    categoryId: taskCategory.id,
    duration: inferredDuration, // Retorna la duración real de la categoría
    tier: inferredTier // Retorna el tier real de la categoría
  };
}

async function syncClickUpData() {
  console.log('Iniciando sincronización inicial de tareas desde ClickUp...');

  try {
    // Ya tienes usuarios y marcas creados, por lo que solo sincronizaremos tareas.
    // 1. Obtener todas las marcas locales para iterar sobre sus listas de ClickUp
    const localBrands = await prisma.brand.findMany({
      where: {
        isActive: true, // Solo marcas activas
      }
    });

    if (localBrands.length === 0) {
      console.warn('No se encontraron marcas locales activas con ClickUp List IDs. Omite la sincronización de tareas.');
      return;
    }

    for (const brand of localBrands) {
      console.log(`\n--- Sincronizando Tareas para Brand: ${brand.name} (ClickUp List ID: ${brand.id}) ---`);
      
      // Obtener tareas de ClickUp para la lista asociada a la marca
      const tasksResponse = await axios.get(`${CLICKUP_API_BASE}/list/${brand.id}/task`, {
        headers: { 'Authorization': CLICKUP_TOKEN },
        params: {
          subtasks: true, // Incluir subtareas si es necesario
          // No filtramos por status aquí, lo haremos después de obtenerlas
        },
      });
      const clickupTasks = tasksResponse.data.tasks;

      for (const ct of clickupTasks) {
        // ✅ NUEVO FILTRO: Omitir tareas con estado "Complete"
        if (CLICKUP_COMPLETE_STATUSES.includes(ct.status.status.toLowerCase())) {
          console.log(`  Skipping completed task: ${ct.name} (Status: ${ct.status.status})`);
          continue; // Saltar a la siguiente tarea
        }

        // Pasa los tags de ClickUp a la función de inferencia
        const { typeId, categoryId } = await inferTaskTypeAndCategory(ct.name, ct.tags.map((t: any) => t.name));

        // Mapear asignados de ClickUp a IDs de usuarios locales
        const clickupAssigneeIds = ct.assignees ? ct.assignees.map((a: any) => a.id.toString()) : [];
        const localAssignees = await prisma.user.findMany({
          where: { id: { in: clickupAssigneeIds } },
          select: { id: true },
        });
        const localAssigneeIds = localAssignees.map(u => u.id);

        const task = await prisma.task.upsert({
          where: { id: ct.id },
          update: {
            name: ct.name,
            description: ct.description || null,
            status: mapClickUpStatusToLocal(ct.status.status, brand.statusMapping),
            priority: clickupPriorityMap[ct.priority] || Priority.NORMAL,
            startDate: ct.start_date ? new Date(parseInt(ct.start_date)) : new Date(),
            deadline: ct.due_date ? new Date(parseInt(ct.due_date)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días por defecto
            url: ct.url,
            lastSyncAt: new Date(),
            syncStatus: 'SYNCED',
            typeId: typeId,
            categoryId: categoryId,
            brandId: brand.id,
            // timeEstimate: ct.time_estimate ? ct.time_estimate : null, // ClickUp time_estimate es en ms
            // tags: JSON.stringify(ct.tags.map((t: any) => t.name)),
            // queuePosition: ... (esto es más complejo de mapear desde ClickUp, puede que necesites un valor por defecto o lógica específica)
          },
          create: {
            name: ct.name,
            description: ct.description || null,
            status: mapClickUpStatusToLocal(ct.status.status, brand.statusMapping),
            priority: clickupPriorityMap[ct.priority] || Priority.NORMAL,
            startDate: ct.start_date ? new Date(parseInt(ct.start_date)) : new Date(),
            deadline: ct.due_date ? new Date(parseInt(ct.due_date)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            id: ct.id,
            url: ct.url,
            lastSyncAt: new Date(),
            syncStatus: 'SYNCED',
            typeId: typeId,
            categoryId: categoryId,
            brandId: brand.id,
            queuePosition: 0, // Valor por defecto, ajustar según tu lógica de cola
          },
        });

        // Sincronizar asignaciones de tareas
        await prisma.taskAssignment.deleteMany({
          where: { taskId: task.id },
        });
        if (localAssigneeIds.length > 0) {
          await prisma.taskAssignment.createMany({
            data: localAssigneeIds.map(userId => ({
              taskId: task.id,
              userId: userId,
            })),
            skipDuplicates: true,
          });
        }
        console.log(`  Tarea sincronizada: ${task.name} (ClickUp ID: ${task.id})`);
      }
    }

    console.log('\nSincronización inicial de tareas completada exitosamente.');
  } catch (error: any) {
    console.error('Error durante la sincronización inicial de tareas:', error.response?.data || error.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncClickUpData();
