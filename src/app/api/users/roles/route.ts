// src/app/api/users/roles/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface CreateRoleRequest {
  userId: string;
  typeId: number;
  brandId?: string | null;
}

/**
 * POST /api/users/roles
 * Agrega un nuevo rol a un usuario
 */
export async function POST(req: Request) {
  try {
    const body: CreateRoleRequest = await req.json();
    const { userId, typeId, brandId } = body;

    // Validar campos requeridos
    if (!userId || !typeId) {
      return NextResponse.json({
        error: 'userId and typeId are required',
        required: ['userId', 'typeId']
      }, { status: 400 });
    }

    console.log(`🔄 Adding role to user ${userId}: typeId=${typeId}, brandId=${brandId || 'null'}`);

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }

    // Verificar que el tipo existe
    const taskType = await prisma.taskType.findUnique({
      where: { id: typeId }
    });

    if (!taskType) {
      return NextResponse.json({
        error: 'Task type not found'
      }, { status: 404 });
    }

    // Verificar que el brand existe si se proporciona
    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId }
      });

      if (!brand) {
        return NextResponse.json({
          error: 'Brand not found'
        }, { status: 404 });
      }
    }

    // Verificar que el rol no existe ya
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: userId,
        typeId: typeId,
        brandId: brandId || null
      }
    });

    if (existingRole) {
      return NextResponse.json({
        error: 'Role already exists for this user'
      }, { status: 409 });
    }

    // Crear el rol
    const newRole = await prisma.userRole.create({
      data: {
        userId: userId,
        typeId: typeId,
        brandId: brandId || null
      },
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
    });

    console.log(`✅ Role created successfully: ${newRole.type.name} ${newRole.brand ? `for ${newRole.brand.name}` : '(Global)'}`);

    return NextResponse.json(newRole, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating user role:', error);
    
    return NextResponse.json({
      error: 'Internal server error creating role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}