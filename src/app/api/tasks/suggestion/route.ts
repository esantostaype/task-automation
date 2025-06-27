// app/api/tasks/suggestion/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { getNextAvailableStart } from '@/utils/task-calculation-utils';
import { Priority } from '@prisma/client';

/**
 * Maneja las solicitudes GET para obtener una sugerencia de usuario y duración
 * para una nueva tarea, basándose en el brand, categoría y prioridad.
 * @param req Objeto de solicitud.
 * @returns Respuesta JSON con el ID del usuario sugerido y la duración estimada en horas.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const categoryId = parseInt(searchParams.get('categoryId') || '0');
    const priority = searchParams.get('priority') as Priority;

    if (!brandId || !categoryId || !priority) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos: brandId, categoryId, priority' }, { status: 400 });
    }

    const category = await prisma.taskCategory.findUnique({
      where: { id: categoryId },
      include: { type: true },
    });

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Replicar la lógica de asignación de usuario desde POST /api/tasks
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
      user.roles.some(role => role.typeId === category.type.id)
    );

    if (compatibleUsers.length === 0) {
      return NextResponse.json({ error: 'No hay usuarios compatibles disponibles para asignación automática' }, { status: 400 });
    }

    const userSlots = await Promise.all(compatibleUsers.map(async (user) => {
      const tasks = await prisma.task.findMany({
        where: {
          typeId: category.type.id,
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

      const matchingRoles = user.roles.filter(role => role.typeId === category.type.id);
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
          }
        } else {
          bestSlot = generalists[0];
        }
      }
    }

    if (!bestSlot) {
      return NextResponse.json({ error: 'No se pudo encontrar un diseñador óptimo para la asignación automática.' }, { status: 400 });
    }

    // La duración se basa en la categoría seleccionada
    const estimatedDurationHours = category.duration * 8; // Convertir días de la categoría a horas

    return NextResponse.json({
      suggestedUserId: bestSlot.userId,
      estimatedDurationHours: estimatedDurationHours,
    });

  } catch (error) {
    console.error('Error al obtener sugerencia de tarea:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al obtener sugerencia',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
