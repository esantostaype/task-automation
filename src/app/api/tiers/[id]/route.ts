import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * PATCH /api/tiers/[id]
 * Actualiza la duración de un tier específico
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await req.json();
    const { duration } = body;

    // Validar que la duración sea válida
    if (typeof duration !== 'number' || duration <= 0) {
      return NextResponse.json({
        error: 'Duration must be a positive number'
      }, { status: 400 });
    }

    // Verificar que el tier existe
    const existingTier = await prisma.tierList.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTier) {
      return NextResponse.json({
        error: 'Tier not found'
      }, { status: 404 });
    }

    // Actualizar la duración
    const updatedTier = await prisma.tierList.update({
      where: { id: parseInt(id) },
      data: { duration },
      include: {
        categories: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ Updated tier ${updatedTier.name}: duration ${existingTier.duration} → ${duration}`);

    return NextResponse.json({
      ...updatedTier,
      previousDuration: existingTier.duration,
      categoryCount: updatedTier.categories.length
    });

  } catch (error) {
    console.error('❌ Error updating tier:', error);
    return NextResponse.json({
      error: 'Error updating tier',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}