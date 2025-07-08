// src/app/api/users/vacations/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface CreateVacationRequest {
  userId: string;
  startDate: string;
  endDate: string;
}

/**
 * POST /api/users/vacations
 * Agrega un nuevo período de vacaciones a un usuario
 */
export async function POST(req: Request) {
  try {
    const body: CreateVacationRequest = await req.json();
    const { userId, startDate, endDate } = body;

    // Validar campos requeridos
    if (!userId || !startDate || !endDate) {
      return NextResponse.json({
        error: 'userId, startDate, and endDate are required',
        required: ['userId', 'startDate', 'endDate']
      }, { status: 400 });
    }

    console.log(`🔄 Adding vacation to user ${userId}: ${startDate} to ${endDate}`);

    // Convertir fechas
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    // Validar fechas
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    if (startDateObj >= endDateObj) {
      return NextResponse.json({
        error: 'End date must be after start date'
      }, { status: 400 });
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true }
    });

    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Verificar conflictos con vacaciones existentes
    const conflictingVacations = await prisma.userVacation.findMany({
      where: {
        userId: userId,
        OR: [
          {
            AND: [
              { startDate: { lte: startDateObj } },
              { endDate: { gte: startDateObj } }
            ]
          },
          {
            AND: [
              { startDate: { lte: endDateObj } },
              { endDate: { gte: endDateObj } }
            ]
          },
          {
            AND: [
              { startDate: { gte: startDateObj } },
              { endDate: { lte: endDateObj } }
            ]
          }
        ]
      }
    });

    if (conflictingVacations.length > 0) {
      return NextResponse.json({
        error: 'Vacation period conflicts with existing vacation',
        conflictingVacations: conflictingVacations.map(v => ({
          id: v.id,
          startDate: v.startDate.toISOString().split('T')[0],
          endDate: v.endDate.toISOString().split('T')[0]
        }))
      }, { status: 409 });
    }

    // Crear la vacación
    const newVacation = await prisma.userVacation.create({
      data: {
        userId: userId,
        startDate: startDateObj,
        endDate: endDateObj
      }
    });

    const durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`✅ Vacation created successfully: ${durationDays} days for user ${user.name}`);

    return NextResponse.json({
      ...newVacation,
      startDate: newVacation.startDate.toISOString().split('T')[0],
      endDate: newVacation.endDate.toISOString().split('T')[0],
      durationDays
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user vacation:', error);
    
    return NextResponse.json({
      error: 'Internal server error creating vacation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}