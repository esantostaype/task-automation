// src/app/api/users/vacations/[vacationId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface RouteParams {
  params: {
    vacationId: string;
  };
}

/**
 * DELETE /api/users/vacations/[vacationId]
 * Elimina un período de vacaciones específico de un usuario
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { vacationId } = params;

    if (!vacationId) {
      return NextResponse.json({
        error: 'Vacation ID is required'
      }, { status: 400 });
    }

    const vacationIdInt = parseInt(vacationId);
    
    if (isNaN(vacationIdInt)) {
      return NextResponse.json({
        error: 'Vacation ID must be a valid number'
      }, { status: 400 });
    }

    console.log(`🔄 Deleting vacation: ${vacationIdInt}`);

    // Verificar que la vacación existe y obtener información para logging
    const existingVacation = await prisma.userVacation.findUnique({
      where: { id: vacationIdInt },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!existingVacation) {
      return NextResponse.json({
        error: 'Vacation not found'
      }, { status: 404 });
    }

    // Verificar si la vacación ya ha comenzado (opcional: prevenir eliminación de vacaciones en curso)
    const now = new Date();
    const isOngoing = existingVacation.startDate <= now && existingVacation.endDate >= now;
    
    if (isOngoing) {
      console.log(`⚠️ Warning: Deleting ongoing vacation for user ${existingVacation.user.name}`);
    }

    // Eliminar la vacación
    await prisma.userVacation.delete({
      where: { id: vacationIdInt }
    });

    const durationDays = Math.ceil(
      (existingVacation.endDate.getTime() - existingVacation.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log(`✅ Vacation deleted successfully: ${durationDays} days vacation for user ${existingVacation.user.name}`);

    return NextResponse.json({
      message: 'Vacation deleted successfully',
      deletedVacation: {
        id: existingVacation.id,
        userName: existingVacation.user.name,
        startDate: existingVacation.startDate.toISOString().split('T')[0],
        endDate: existingVacation.endDate.toISOString().split('T')[0],
        durationDays,
        wasOngoing: isOngoing
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user vacation:', error);
    
    return NextResponse.json({
      error: 'Internal server error deleting vacation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}