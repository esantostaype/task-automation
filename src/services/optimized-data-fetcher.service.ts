// src/services/optimizedDataFetcher.service.ts - SIN queuePosition
import { prisma } from '@/utils/prisma';
import { Status } from '@prisma/client';
import { User, UserRole, Task, TaskCategory, TaskType, Brand, TaskAssignment } from '@/interfaces';

export interface MinimalTaskType {
  id: number;
  name: string;
}

export interface UserWithOptimizedData extends User {
  roles: (UserRole & { type: MinimalTaskType | null })[];
  tasks: (TaskAssignment & {
    task: Task & {
      category: TaskCategory;
      type: TaskType;
      brand: Brand;
      assignees: (TaskAssignment & { user: User })[];
    };
  })[];
}

/**
 * ✅ ACTUALIZADO: Obtiene usuarios con tareas ordenadas por fecha, SIN queuePosition
 */
export async function getOptimizedUserData(typeId: number, brandId: string): Promise<UserWithOptimizedData[]> {
  const users = await prisma.user.findMany({
    where: { active: true },
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId },
            { brandId: null }
          ]
        },
        include: { type: true }
      },
      tasks: {
        where: {
          task: {
            status: {
              notIn: [Status.COMPLETE],
            },
            typeId: typeId,
            brandId: brandId,
          },
        },
        include: {
          task: {
            include: {
              category: true,
              type: true,
              brand: true,
              assignees: {
                include: { user: true }
              }
            }
          }
        },
        // ✅ CAMBIO: Ordenar por startDate en lugar de queuePosition
        orderBy: { task: { startDate: 'asc' } }
      },
    },
  });

  return users as unknown as UserWithOptimizedData[];
}