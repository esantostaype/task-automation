// src/app/api/tasks/suggestion/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getBestUserWithCache } from '@/services/task-assignment.service'; // Usar la nueva función cacheada

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

    // Usar la función centralizada y cacheada para seleccionar el mejor usuario
    const bestSlot = await getBestUserWithCache(category.type.id, brandId, priority);

    if (!bestSlot) {
      return NextResponse.json({ error: 'No se pudo encontrar un diseñador óptimo para la asignación automática.' }, { status: 400 });
    }

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