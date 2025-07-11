// src/app/api/users/enhanced/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import {
  getNextAvailableStart,
  calculateWorkingDeadline
} from '@/utils/task-calculation-utils';

interface EnhancedUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isSpecialist: boolean;
  status: 'available' | 'on_vacation' | 'overloaded';
  availableFrom: string;
  hasVacationConflict: boolean;
  currentWorkload: {
    taskCount: number;
    durationDays: number;
    lastTaskDeadline?: string;
  };
  vacationInfo?: {
    currentVacation?: {
      startDate: string;
      endDate: string;
      durationDays: number;
      returnDate: string; // Primer día laboral después de vacaciones
    };
    upcomingVacations: Array<{
      startDate: string;
      endDate: string;
      durationDays: number;
    }>;
  };
  recommendation?: {
    shouldWaitForReturn: boolean;
    daysSavedByWaiting: number;
    alternativeStartDate: string;
    reason: string;
  };
}

interface EnhancedUsersResponse {
  availableUsers: EnhancedUser[];
  usersOnVacation: EnhancedUser[];
  overloadedUsers: EnhancedUser[];
  smartSuggestion?: {
    userId: string;
    reason: string;
    alternativeStartDate: string;
    daysSaved: number;
  };
  totalCompatible: number;
  message: string;
}

/**
 * GET /api/users/enhanced
 * Obtiene usuarios con análisis completo de disponibilidad y recomendaciones inteligentes
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

    console.log(`🧠 === ENHANCED USER ANALYSIS ===`);
    console.log(`📋 Params: typeId=${typeId}, brandId=${brandId || 'global'}, duration=${durationDays} days`);

    // Obtener usuarios compatibles con datos completos
    const allUsersWithData = await prisma.user.findMany({
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

    // Filtrar solo usuarios compatibles
    const compatibleUsers = allUsersWithData.filter(user =>
      user.roles.some(role => role.typeId === typeId)
    );

    console.log(`👥 Found ${compatibleUsers.length} compatible users for type ${typeId}`);

    const availableUsers: EnhancedUser[] = [];
    const usersOnVacation: EnhancedUser[] = [];
    const overloadedUsers: EnhancedUser[] = [];

    for (const user of compatibleUsers) {
      console.log(`\n👤 Analyzing ${user.name} (${user.id})`);

      // Verificar si es especialista
      const matchingRoles = user.roles.filter(role => role.typeId === typeId);
      const isSpecialist = matchingRoles.length === 1 && user.roles.length === 1;

      // Obtener carga de trabajo actual
      const userTasks = await prisma.task.findMany({
        where: {
          assignees: { some: { userId: user.id } },
          status: { notIn: ['COMPLETE'] }
        },
        orderBy: { startDate: 'asc' },
        include: {
          category: {
            include: {
              tierList: true // Para acceder a duration
            }
          }
        }
      });

      const currentWorkload = {
        taskCount: userTasks.length,
        durationDays: userTasks.reduce((sum, task) => {
          // Usar customDuration si existe, sino usar duration de tierList
          return sum + (task.customDuration !== null ? task.customDuration : task.category.tierList.duration);
        }, 0),
        lastTaskDeadline: userTasks.length > 0 ? userTasks[userTasks.length - 1].deadline.toISOString().split('T')[0] : undefined
      };

      // Calcular disponibilidad base
      let baseAvailableDate: Date;
      if (userTasks.length > 0) {
        const lastTask = userTasks[userTasks.length - 1];
        baseAvailableDate = await getNextAvailableStart(new Date(lastTask.deadline));
      } else {
        baseAvailableDate = await getNextAvailableStart(new Date());
      }

      // Analizar vacaciones
      const upcomingVacations = user.vacations.map(v => ({
        id: v.id,
        startDate: new Date(v.startDate),
        endDate: new Date(v.endDate),
        durationDays: Math.ceil((new Date(v.endDate).getTime() - new Date(v.startDate).getTime()) / (1000 * 60 * 60 * 24))
      }));

      // Verificar vacación actual
      const now = new Date();
      const currentVacation = upcomingVacations.find(vacation =>
        vacation.startDate <= now && vacation.endDate >= now
      );

      // Calcular timeline de tarea potencial
      const taskHours = durationDays * 8;
      const potentialTaskEnd = await calculateWorkingDeadline(baseAvailableDate, taskHours);

      // Verificar conflictos con vacaciones
      let hasVacationConflict = false;
      let conflictingVacation = null;

      for (const vacation of upcomingVacations) {
        const hasConflict = baseAvailableDate <= vacation.endDate && potentialTaskEnd >= vacation.startDate;
        if (hasConflict) {
          hasVacationConflict = true;
          conflictingVacation = vacation;
          break;
        }
      }

      // Calcular fecha de regreso de vacaciones (si aplica)
      let returnDate: Date | null = null;
      if (currentVacation || conflictingVacation) {
        const relevantVacation = currentVacation || conflictingVacation!;
        const dayAfterVacation = new Date(relevantVacation.endDate);
        dayAfterVacation.setDate(dayAfterVacation.getDate() + 1);
        returnDate = await getNextAvailableStart(dayAfterVacation);
      }

      // Análisis de recomendación inteligente
      let recommendation: EnhancedUser['recommendation'] = undefined;

      if (hasVacationConflict && returnDate) {
        // Calcular cuántos días se ahorrarían esperando vs asignar a usuarios disponibles
        const workingDaysUntilReturn = Math.ceil((returnDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const workingDaysUntilAvailable = Math.ceil((baseAvailableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const daysSavedByWaiting = Math.max(0, workingDaysUntilAvailable - workingDaysUntilReturn);

        if (daysSavedByWaiting > 5) { // Solo recomendar si ahorra más de 5 días
          recommendation = {
            shouldWaitForReturn: true,
            daysSavedByWaiting,
            alternativeStartDate: returnDate.toISOString().split('T')[0],
            reason: `Waiting for return saves ${daysSavedByWaiting} days vs current workload`
          };
        }
      }

      // Crear objeto de usuario mejorado
      const enhancedUser: EnhancedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        active: user.active,
        isSpecialist,
        status: currentVacation || hasVacationConflict ? 'on_vacation' :
          currentWorkload.durationDays > 15 ? 'overloaded' : 'available',
        availableFrom: (returnDate || baseAvailableDate).toISOString().split('T')[0],
        hasVacationConflict,
        currentWorkload,
        vacationInfo: upcomingVacations.length > 0 ? {
          currentVacation: currentVacation ? {
            startDate: currentVacation.startDate.toISOString().split('T')[0],
            endDate: currentVacation.endDate.toISOString().split('T')[0],
            durationDays: currentVacation.durationDays,
            returnDate: returnDate!.toISOString().split('T')[0]
          } : undefined,
          upcomingVacations: upcomingVacations.map(v => ({
            startDate: v.startDate.toISOString().split('T')[0],
            endDate: v.endDate.toISOString().split('T')[0],
            durationDays: v.durationDays
          }))
        } : undefined,
        recommendation
      };

      // Clasificar usuario
      if (enhancedUser.status === 'available') {
        availableUsers.push(enhancedUser);
      } else if (enhancedUser.status === 'on_vacation') {
        usersOnVacation.push(enhancedUser);
      } else {
        overloadedUsers.push(enhancedUser);
      }

      console.log(`   📊 ${user.name}: ${enhancedUser.status} | Workload: ${currentWorkload.durationDays}d | Available: ${enhancedUser.availableFrom}`);
      if (recommendation) {
        console.log(`   💡 Recommendation: Wait for return (saves ${recommendation.daysSavedByWaiting} days)`);
      }
    }

    // Análisis de sugerencia inteligente
    let smartSuggestion: EnhancedUsersResponse['smartSuggestion'] = undefined;

    if (availableUsers.length === 0 && usersOnVacation.length > 0) {
      // No hay usuarios disponibles, buscar mejor opción en vacaciones
      const bestVacationOption = usersOnVacation
        .filter(user => user.recommendation?.shouldWaitForReturn)
        .sort((a, b) => {
          // Priorizar especialistas, luego por días ahorrados
          if (a.isSpecialist && !b.isSpecialist) return -1;
          if (!a.isSpecialist && b.isSpecialist) return 1;
          return (b.recommendation?.daysSavedByWaiting || 0) - (a.recommendation?.daysSavedByWaiting || 0);
        })[0];

      if (bestVacationOption && bestVacationOption.recommendation) {
        smartSuggestion = {
          userId: bestVacationOption.id,
          reason: `${bestVacationOption.isSpecialist ? 'Specialist' : 'Generalist'} returns soon, saving ${bestVacationOption.recommendation.daysSavedByWaiting} days`,
          alternativeStartDate: bestVacationOption.recommendation.alternativeStartDate,
          daysSaved: bestVacationOption.recommendation.daysSavedByWaiting
        };
      }
    }

    console.log(`\n📊 === ANALYSIS SUMMARY ===`);
    console.log(`✅ Available: ${availableUsers.length}`);
    console.log(`🏖️ On vacation: ${usersOnVacation.length}`);
    console.log(`📈 Overloaded: ${overloadedUsers.length}`);
    if (smartSuggestion) {
      console.log(`💡 Smart suggestion: ${smartSuggestion.reason}`);
    }

    return NextResponse.json({
      availableUsers,
      usersOnVacation,
      overloadedUsers,
      smartSuggestion,
      totalCompatible: compatibleUsers.length,
      message: smartSuggestion
        ? `Smart suggestion: Wait for ${smartSuggestion.userId} to return (saves ${smartSuggestion.daysSaved} days)`
        : availableUsers.length > 0
          ? `${availableUsers.length} designers immediately available`
          : usersOnVacation.length > 0
            ? 'All compatible designers are on vacation'
            : 'No compatible designers found'
    });

  } catch (error) {
    console.error('❌ Error in enhanced user analysis:', error);

    return NextResponse.json({
      error: 'Internal server error in enhanced user analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}