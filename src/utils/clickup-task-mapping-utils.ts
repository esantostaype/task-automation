/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/clickup-task-mapping-utils.ts
import { prisma } from '@/utils/prisma';
import { Priority, Status, Tier } from '@prisma/client';

/**
 * Mapea un estado de ClickUp a un enum de estado local.
 * Usa el statusMapping del brand si existe, de lo contrario un fallback.
 * @param clickupStatus El estado de la tarea en ClickUp.
 * @param brandStatusMapping El objeto de mapeo de estados del brand.
 * @returns El estado mapeado a tu enum local `Status`.
 */

export const clickupPriorityMap: Record<Priority, number> = {
  'URGENT': 1,
  'HIGH': 2,
  'NORMAL': 3,
  'LOW': 4
};

export function mapClickUpStatusToLocal(clickupStatus: string): Status {
  switch (clickupStatus.toLowerCase()) {
    case 'to do':
      return Status.TO_DO;
    case 'in progress':
      return Status.IN_PROGRESS;
    case 'on approval':
      return Status.ON_APPROVAL;
    case 'complete':
      return Status.COMPLETE;
    default:
      return Status.TO_DO; // Default fallback
  }
}

export const getClickUpStatusName = (localStatus: Status): string => {
  switch (localStatus) {
    case Status.TO_DO: 
      return 'to do';
    case Status.IN_PROGRESS: 
      return 'in progress';
    case Status.ON_APPROVAL: 
      return 'on approval';
    case Status.COMPLETE: 
      return 'complete';
    default: 
      return 'to do';
  }
}
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
    taskCategory = await prisma.taskCategory.create({
      data: {
        name: inferredCategoryName,
        duration: inferredDuration, // Default duration in days if new category
        tier: inferredTier,         // Default tier if new category
        typeId: taskType.id,
      },
    });
    console.log(`  -> Creada nueva TaskCategory: ${taskCategory.name} (Type: ${taskType.name})`);
  }

  return {
    typeId: taskType.id,
    categoryId: taskCategory.id
  };
}