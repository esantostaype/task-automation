/* eslint-disable @typescript-eslint/no-unused-vars */
// src/utils/clickup-task-mapping-utils.ts - VERSIÓN CORREGIDA PARA MAPEO DE ESTADOS

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/utils/prisma';
import { Priority, Status, Tier } from '@prisma/client';

/**
 * ✅ MAPA MEJORADO: Mapea prioridades locales a valores de ClickUp
 */
export const clickupPriorityMap: Record<Priority, number> = {
  'URGENT': 1,
  'HIGH': 2,
  'NORMAL': 3,
  'LOW': 4
};

/**
 * ✅ FUNCIÓN MEJORADA: Mapea estados de ClickUp a estados locales con logging detallado
 */
export function mapClickUpStatusToLocal(clickupStatus: string): Status {
  console.log(`🔄 Mapeando estado de ClickUp: "${clickupStatus}"`);
  
  // Normalizar el estado (minúsculas y trim)
  const normalizedStatus = clickupStatus.toLowerCase().trim();
  
  // Mapeo exhaustivo de posibles variaciones de estados
  const statusMap: Record<string, Status> = {
    // TO_DO variations
    'to do': Status.TO_DO,
    'todo': Status.TO_DO,
    'open': Status.TO_DO,
    'backlog': Status.TO_DO,
    'new': Status.TO_DO,
    'pending': Status.TO_DO,
    
    // IN_PROGRESS variations  
    'in progress': Status.IN_PROGRESS,
    'inprogress': Status.IN_PROGRESS,
    'in-progress': Status.IN_PROGRESS,
    'working': Status.IN_PROGRESS,
    'active': Status.IN_PROGRESS,
    'doing': Status.IN_PROGRESS,
    'wip': Status.IN_PROGRESS,
    
    // ON_APPROVAL variations
    'on approval': Status.ON_APPROVAL,
    'onapproval': Status.ON_APPROVAL,
    'on-approval': Status.ON_APPROVAL,
    'approval': Status.ON_APPROVAL,
    'review': Status.ON_APPROVAL,
    'reviewing': Status.ON_APPROVAL,
    'pending review': Status.ON_APPROVAL,
    'pending approval': Status.ON_APPROVAL,
    'waiting for approval': Status.ON_APPROVAL,
    'for review': Status.ON_APPROVAL,
    'ready for review': Status.ON_APPROVAL,
    'under review': Status.ON_APPROVAL,
    
    // COMPLETE variations
    'complete': Status.COMPLETE,
    'completed': Status.COMPLETE,
    'done': Status.COMPLETE,
    'finished': Status.COMPLETE,
    'closed': Status.COMPLETE,
    'resolved': Status.COMPLETE,
    'delivered': Status.COMPLETE,
    'approved': Status.COMPLETE,
  };
  
  const mappedStatus = statusMap[normalizedStatus];
  
  if (mappedStatus) {
    console.log(`✅ Estado mapeado: "${clickupStatus}" → ${mappedStatus}`);
    return mappedStatus;
  } else {
    console.warn(`⚠️ Estado no reconocido: "${clickupStatus}", usando TO_DO por defecto`);
    return Status.TO_DO; // Default fallback
  }
}

/**
 * ✅ FUNCIÓN MEJORADA: Mapea estados locales a nombres de ClickUp
 */
export const getClickUpStatusName = (localStatus: Status): string => {
  console.log(`🔄 Convirtiendo estado local a ClickUp: ${localStatus}`);
  
  const statusMap: Record<Status, string> = {
    [Status.TO_DO]: 'to do',
    [Status.IN_PROGRESS]: 'in progress', 
    [Status.ON_APPROVAL]: 'review', // ✅ Mapear a 'review' que es más común en ClickUp
    [Status.COMPLETE]: 'complete'
  };
  
  const clickupStatus = statusMap[localStatus] || 'to do';
  console.log(`✅ Estado convertido: ${localStatus} → "${clickupStatus}"`);
  
  return clickupStatus;
};

/**
 * ✅ NUEVA FUNCIÓN: Debug de mapeo de estados para troubleshooting
 */
export function debugStatusMapping(clickupStatuses: string[]): void {
  console.log('\n🔍 === DEBUG DE MAPEO DE ESTADOS ===');
  console.log('Estados únicos encontrados en ClickUp:');
  
  const uniqueStatuses = [...new Set(clickupStatuses)];
  uniqueStatuses.forEach(status => {
    const mapped = mapClickUpStatusToLocal(status);
    console.log(`  "${status}" → ${mapped}`);
  });
  
  console.log('\nMapeos disponibles:');
  Object.values(Status).forEach(localStatus => {
    const clickupName = getClickUpStatusName(localStatus);
    console.log(`  ${localStatus} → "${clickupName}"`);
  });
  console.log('===========================================\n');
}

/**
 * ✅ FUNCIÓN EXISTENTE: Inferir tipo y categoría (sin cambios)
 */
export async function inferTaskTypeAndCategory(taskName: string, clickupTags: string[]): Promise<{ typeId: number; categoryId: number }> {
  let inferredTypeName: string | null = null;
  let inferredCategoryName: string | null = null;
  let inferredDuration: number = 2; // Default days (used if category needs to be created)
  let inferredTier: Tier = Tier.C; // Default tier (used if category needs to be created)

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
    // ✅ CORRECCIÓN: Buscar el tier por nombre
    const tierRecord = await prisma.tierList.findUnique({
      where: { name: inferredTier }
    });
    
    if (!tierRecord) {
      throw new Error(`Tier ${inferredTier} not found in database`);
    }
    
    taskCategory = await prisma.taskCategory.create({
      data: {
        name: inferredCategoryName,
        typeId: taskType.id,
        tierId: tierRecord.id, // ✅ Usar el ID del tier
      },
    });
    console.log(`  -> Creada nueva TaskCategory: ${taskCategory.name} (Type: ${taskType.name})`);
  }

  return {
    typeId: taskType.id,
    categoryId: taskCategory.id
  };
}