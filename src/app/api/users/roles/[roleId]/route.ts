// src/app/api/users/roles/[roleId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

interface RouteParams {
  params: {
    roleId: string;
  };
}

/**
 * DELETE /api/users/roles/[roleId]
 * Elimina un rol específico de un usuario
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { roleId } = params;

    if (!roleId) {
      return NextResponse.json({
        error: 'Role ID is required'
      }, { status: 400 });
    }

    const roleIdInt = parseInt(roleId);
    
    if (isNaN(roleIdInt)) {
      return NextResponse.json({
        error: 'Role ID must be a valid number'
      }, { status: 400 });
    }

    console.log(`🔄 Deleting role: ${roleIdInt}`);

    // Verificar que el rol existe y obtener información para logging
    const existingRole = await prisma.userRole.findUnique({
      where: { id: roleIdInt },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        },
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

    if (!existingRole) {
      return NextResponse.json({
        error: 'Role not found'
      }, { status: 404 });
    }

    // Eliminar el rol
    await prisma.userRole.delete({
      where: { id: roleIdInt }
    });

    console.log(`✅ Role deleted successfully: ${existingRole.type.name} ${existingRole.brand ? `for ${existingRole.brand.name}` : '(Global)'} from user ${existingRole.user.name}`);

    return NextResponse.json({
      message: 'Role deleted successfully',
      deletedRole: {
        id: existingRole.id,
        typeName: existingRole.type.name,
        brandName: existingRole.brand?.name || 'Global',
        userName: existingRole.user.name
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user role:', error);
    
    return NextResponse.json({
      error: 'Internal server error deleting role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}