/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/sync/clickup-users/[userId]/route.ts - Endpoint para información detallada de un usuario

import { NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/utils/prisma';
import { API_CONFIG } from '@/config';

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

interface RouteParams {
  params: {
    userId: string;
  };
}

/**
 * GET /api/sync/clickup-users/[userId]
 * Obtiene información detallada de un usuario específico de ClickUp
 */
export async function GET(req: Request, { params }: RouteParams) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  const { userId } = params;

  if (!userId) {
    return NextResponse.json({
      error: 'userId es requerido'
    }, { status: 400 });
  }

  try {
    console.log(`🔍 Obteniendo información detallada del usuario ${userId}...`);

    // ✅ NUEVA ESTRATEGIA: Usar endpoint /team en lugar de /user/{userId}
    // que no está disponible para todos los tipos de token
    
    const [teamsResponse, localUser] = await Promise.all([
      axios.get(
        `${API_CONFIG.CLICKUP_API_BASE}/team`,
        {
          headers: {
            'Authorization': CLICKUP_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      ),
      // Verificar si existe en la DB local
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              type: true
            }
          }
        }
      })
    ]);

    // Buscar el usuario específico en los teams
    let clickupUser: any = null;
    
    for (const team of teamsResponse.data.teams) {
      for (const member of team.members) {
        if (member.user && member.user.id.toString() === userId) {
          clickupUser = member.user;
          break;
        }
      }
      if (clickupUser) break;
    }

    if (!clickupUser) {
      return NextResponse.json({
        error: 'Usuario no encontrado en ningún team de ClickUp',
        userId: userId,
        availableUsers: teamsResponse.data.teams.flatMap((team: any) => 
          team.members.map((member: any) => ({
            id: member.user?.id?.toString(),
            name: member.user?.username
          }))
        ).filter(Boolean)
      }, { status: 404 });
    }

    // Información combinada
    const userInfo = {
      clickup: {
        id: clickupUser.id.toString(),
        username: clickupUser.username,
        email: clickupUser.email,
        color: clickupUser.color,
        profilePicture: clickupUser.profilePicture,
        initials: clickupUser.initials,
        role: clickupUser.role,
        roleKey: clickupUser.role_key,
        lastActive: clickupUser.last_active,
        dateJoined: clickupUser.date_joined,
        dateInvited: clickupUser.date_invited,
      },
      local: localUser ? {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        active: localUser.active,
        roles: localUser.roles.map(role => ({
          id: role.id,
          typeId: role.typeId,
          typeName: role.type?.name || 'Unknown',
          brandId: role.brandId
        }))
      } : null,
      syncStatus: {
        existsInLocal: !!localUser,
        canSync: !localUser,
        lastSyncCheck: new Date().toISOString()
      }
    };

    console.log(`✅ Información obtenida para usuario ${clickupUser.username}`);

    return NextResponse.json(userInfo);

  } catch (error) {
    console.error(`❌ Error obteniendo usuario ${userId}:`, error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener información de ClickUp teams',
        details: message,
        status: status
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * POST /api/sync/clickup-users/[userId]
 * Sincroniza un usuario específico de ClickUp a la base de datos local
 */
export async function POST(req: Request, { params }: RouteParams) {
  if (!CLICKUP_TOKEN) {
    return NextResponse.json({ 
      error: 'CLICKUP_API_TOKEN no configurado' 
    }, { status: 500 });
  }

  const { userId } = params;

  if (!userId) {
    return NextResponse.json({
      error: 'userId es requerido'
    }, { status: 400 });
  }

  try {
    console.log(`🔄 Sincronizando usuario individual ${userId}...`);

    // Verificar que el usuario no exista ya en la DB local
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true }
    });

    if (existingUser) {
      return NextResponse.json({
        error: 'El usuario ya existe en la base de datos local',
        existingUser: existingUser
      }, { status: 409 });
    }

    // ✅ NUEVA ESTRATEGIA: Usar endpoint /team para encontrar el usuario
    const teamsResponse = await axios.get(
      `${API_CONFIG.CLICKUP_API_BASE}/team`,
      {
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    // Buscar el usuario específico en los teams
    let clickupUser: any = null;
    
    for (const team of teamsResponse.data.teams) {
      for (const member of team.members) {
        if (member.user && member.user.id.toString() === userId) {
          clickupUser = member.user;
          break;
        }
      }
      if (clickupUser) break;
    }

    if (!clickupUser) {
      return NextResponse.json({
        error: 'Usuario no encontrado en ningún team de ClickUp',
        userId: userId
      }, { status: 404 });
    }

    // Crear usuario en la base de datos local
    const newUser = await prisma.user.create({
      data: {
        id: clickupUser.id.toString(),
        name: clickupUser.username,
        email: clickupUser.email,
        active: true,
      }
    });

    console.log(`✅ Usuario ${newUser.name} sincronizado exitosamente`);

    return NextResponse.json({
      message: 'Usuario sincronizado exitosamente',
      user: newUser,
      clickupData: {
        username: clickupUser.username,
        email: clickupUser.email,
        role: clickupUser.role_key,
        lastActive: clickupUser.last_active
      }
    });

  } catch (error) {
    console.error(`❌ Error sincronizando usuario ${userId}:`, error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.err || error.message;
      
      return NextResponse.json({
        error: 'Error al obtener información de ClickUp teams',
        details: message
      }, { status: status || 500 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor durante la sincronización',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/sync/clickup-users/[userId]
 * Elimina un usuario de la base de datos local (NO de ClickUp)
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const { userId } = params;

  if (!userId) {
    return NextResponse.json({
      error: 'userId es requerido'
    }, { status: 400 });
  }

  try {
    console.log(`🗑️ Eliminando usuario ${userId} de la base de datos local...`);

    // Verificar que el usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        tasks: true
      }
    });

    if (!existingUser) {
      return NextResponse.json({
        error: 'Usuario no encontrado en la base de datos local',
        userId: userId
      }, { status: 404 });
    }

    // Verificar que no tenga tareas asignadas
    if (existingUser.tasks.length > 0) {
      return NextResponse.json({
        error: 'No se puede eliminar: el usuario tiene tareas asignadas',
        taskCount: existingUser.tasks.length
      }, { status: 409 });
    }

    // Eliminar roles primero (si existen)
    if (existingUser.roles.length > 0) {
      await prisma.userRole.deleteMany({
        where: { userId: userId }
      });
    }

    // Eliminar usuario
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log(`✅ Usuario ${existingUser.name} eliminado exitosamente`);

    return NextResponse.json({
      message: 'Usuario eliminado exitosamente',
      deletedUser: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email
      }
    });

  } catch (error) {
    console.error(`❌ Error eliminando usuario ${userId}:`, error);
    
    return NextResponse.json({
      error: 'Error interno del servidor durante la eliminación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}