// src/app/api/users/[userId]/details/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface RouteParams {
  params: {
    userId: string;
  };
}

/**
 * GET /api/users/[userId]/details
 * Obtiene detalles completos de un usuario incluyendo roles y vacaciones
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({
        error: 'User ID is required'
      }, { status: 400 });
    }

    // Obtener usuario con roles y vacaciones
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            type: {
              select: {
                id: true,
                name: true
              }
            },
            brand: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        vacations: {
          orderBy: {
            startDate: 'asc'
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    console.log(`✅ User details loaded for: ${user.name} (${user.id})`);
    console.log(`   - Roles: ${user.roles.length}`);
    console.log(`   - Vacations: ${user.vacations.length}`);

    return NextResponse.json(user);

  } catch (error) {
    console.error('❌ Error loading user details:', error);
    
    return NextResponse.json({
      error: 'Internal server error loading user details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}