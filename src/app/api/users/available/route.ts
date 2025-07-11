// src/app/api/users/available/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { 
  getNextAvailableStart, 
  calculateWorkingDeadline 
} from '@/utils/task-calculation-utils';

interface AvailableUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isSpecialist: boolean;
  availableFrom: string;
  hasVacationConflict: boolean;
  vacationDetails?: {
    conflictingVacations: Array<{
      startDate: string;
      endDate: string;
      durationDays: number;
    }>;
  };
}

/**
 * GET /api/users/available
 * Obtiene usuarios disponibles (sin conflictos de vacaciones) para una tarea específica
 * Query params: typeId, brandId, durationDays
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const typeId = parseInt(searchParams.get('typeId') || '0');
    const brandId = searchParams.get('brandId');
    const durationDays = parseFloat(searchParams.get('durationDays') || '0');

    // Validar parámetros requeridos
    if (!typeId || typeId <= 0) {
      return NextResponse.json({
        error: 'typeId is required and must be a valid number greater than 0'
      }, { status: 400 });
    }

    if (!durationDays || durationDays <= 0) {
      return NextResponse.json({
        error: 'durationDays is required and must be greater than 0'
      }, { status: 400 });
    }

    console.log(`🔍 === FILTERING AVAILABLE USERS ===`);
    console.log(`📋 Params: typeId=${typeId}, brandId=${brandId || 'global'}, duration=${durationDays} days`);

    // Obtener usuarios compatibles con sus vacaciones
    const allUsersWithRoles = await prisma.user.findMany({
      where: { active: true },
      include: {
        roles: {
          where: {
            typeId: typeId,
            OR: [
              { brandId: brandId },
              { brandId: null }
            ]
          }
        },
        vacations: {
          where: {
            endDate: {
              gte: new Date() // Solo vacaciones futuras/actuales
            }
          }
        }
      }
    });

    // Filtrar solo usuarios que tienen roles compatibles
    const compatibleUsers = allUsersWithRoles.filter(user =>
      user.roles.some(role => role.typeId === typeId)
    );

    console.log(`👥 Found ${compatibleUsers.length} compatible users for type ${typeId}`);

    if (compatibleUsers.length === 0) {
      return NextResponse.json({
        availableUsers: [],
        totalCompatible: 0,
        totalAvailable: 0,
        allOnVacation: false,
        message: 'No compatible users found for this task type'
      });
    }

    const availableUsers: AvailableUser[] = [];
    const unavailableUsers: Array<{name: string, reason: string, vacations: string[]}> = [];

    for (const user of compatibleUsers) {
      console.log(`\n👤 Evaluating ${user.name} (${user.id})`);
      
      // Verificar si es especialista
      const matchingRoles = user.roles.filter(role => role.typeId === typeId);
      const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

      // Obtener tareas actuales del usuario para calcular disponibilidad
      const userTasks = await prisma.task.findMany({
        where: {
          assignees: { some: { userId: user.id } },
          status: { notIn: ['COMPLETE'] }
        },
        orderBy: { deadline: 'asc' },
        include: { category: true }
      });

      // Calcular cuando estaría disponible el usuario
      let baseAvailableDate: Date;
      if (userTasks.length > 0) {
        const lastTask = userTasks[userTasks.length - 1];
        baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      } else {
        baseAvailableDate = await getNextAvailableStart(new Date());
      }

      console.log(`   📅 Base available date: ${baseAvailableDate.toISOString().split('T')[0]}`);

      // Calcular timeline de la tarea potencial
      const taskHours = durationDays * 8;
      const potentialTaskEnd = await calculateWorkingDeadline(baseAvailableDate, taskHours);

      console.log(`   🎯 Potential task: ${baseAvailableDate.toISOString().split('T')[0]} to ${potentialTaskEnd.toISOString().split('T')[0]}`);

      // Verificar conflictos con vacaciones
      const upcomingVacations = user.vacations.map(v => ({
        id: v.id,
        userId: v.userId,
        startDate: new Date(v.startDate),
        endDate: new Date(v.endDate)
      }));

      let hasVacationConflict = false;
      const conflictingVacations: Array<{
        startDate: string;
        endDate: string;
        durationDays: number;
      }> = [];

      for (const vacation of upcomingVacations) {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        
        // Verificar si la tarea se superpone con las vacaciones
        const hasConflict = baseAvailableDate <= vacEnd && potentialTaskEnd >= vacStart;
        
        if (hasConflict) {
          hasVacationConflict = true;
          const durationDays = Math.ceil((vacEnd.getTime() - vacStart.getTime()) / (1000 * 60 * 60 * 24));
          
          conflictingVacations.push({
            startDate: vacStart.toISOString().split('T')[0],
            endDate: vacEnd.toISOString().split('T')[0],
            durationDays
          });
          
          console.log(`   ❌ CONFLICT: Task overlaps with vacation ${vacStart.toISOString().split('T')[0]} to ${vacEnd.toISOString().split('T')[0]}`);
        }
      }

      if (hasVacationConflict) {
        // Usuario no disponible por vacaciones
        unavailableUsers.push({
          name: user.name,
          reason: `Vacation conflict - ${isSpecialist ? 'Specialist' : 'Generalist'}`,
          vacations: conflictingVacations.map(v => `${v.startDate} to ${v.endDate}`)
        });
        
        console.log(`   🚫 EXCLUDED: ${user.name} due to vacation conflicts`);
      } else {
        // Usuario disponible
        console.log(`   ✅ AVAILABLE: ${user.name} - no vacation conflicts`);
        
        availableUsers.push({
          id: user.id,
          name: user.name,
          email: user.email,
          active: user.active,
          isSpecialist,
          availableFrom: baseAvailableDate.toISOString().split('T')[0],
          hasVacationConflict: false
        });
      }
    }

    // Log resultado
    console.log(`\n📊 === AVAILABILITY SUMMARY ===`);
    console.log(`✅ Available users: ${availableUsers.length}`);
    console.log(`❌ Unavailable users: ${unavailableUsers.length}`);
    
    if (unavailableUsers.length > 0) {
      console.log(`\n🚫 Unavailable users details:`);
      unavailableUsers.forEach(user => {
        console.log(`   - ${user.name}: ${user.reason}`);
        user.vacations.forEach(vacation => {
          console.log(`     📅 ${vacation}`);
        });
      });
    }

    const allOnVacation = compatibleUsers.length > 0 && availableUsers.length === 0;

    return NextResponse.json({
      availableUsers,
      totalCompatible: compatibleUsers.length,
      totalAvailable: availableUsers.length,
      allOnVacation,
      unavailableUsers: unavailableUsers.length > 0 ? unavailableUsers : undefined,
      message: allOnVacation 
        ? 'All compatible designers are currently on vacation' 
        : availableUsers.length === 0 
          ? 'No users available for the specified task parameters'
          : `${availableUsers.length} designers available`
    });

  } catch (error) {
    console.error('❌ Error filtering available users:', error);
    
    return NextResponse.json({
      error: 'Internal server error filtering available users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}