/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/api/tasks/route.ts - CORREGIDO CON LÓGICA DE VACACIONES

import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'
import axios from 'axios'
import { Status, Priority } from '@prisma/client'
import {
  calculateUserSlots,
  getBestUserWithCache
} from '@/services/task-assignment.service'
import { createTaskInClickUp } from '@/services/clickup.service'
import { TaskCreationParams, UserSlot, UserWithRoles, ClickUpBrand, TaskWhereInput, UserVacation } from '@/interfaces'
import {
  calculatePriorityInsertion,
  shiftTasksAfterInsertion
} from '@/services/priority-insertion.service'
import { getNextAvailableStart, calculateWorkingDeadline } from '@/utils/task-calculation-utils'
import { invalidateAllCache } from '@/utils/cache'
import { API_CONFIG } from '@/config'

const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN

// ✅ NUEVA FUNCIÓN: Calcular fecha de inicio considerando vacaciones
async function getNextAvailableStartAfterVacations(
  baseDate: Date,
  vacations: UserVacation[],
  taskDurationDays: number = 0
): Promise<Date> {
  let availableDate = await getNextAvailableStart(baseDate);

  const sortedVacations = vacations.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  let adjusted = true;
  const maxIterations = 10;
  let iterations = 0;

  console.log(`🏖️ Verificando ${sortedVacations.length} vacaciones para fecha base: ${baseDate.toISOString()}`);

  while (adjusted && iterations < maxIterations) {
    adjusted = false;
    iterations++;

    const taskHours = taskDurationDays * 8;
    const potentialTaskEnd = taskDurationDays > 0
      ? await calculateWorkingDeadline(availableDate, taskHours)
      : availableDate;

    console.log(`   🔍 Iteración ${iterations}: Verificando ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);

    for (const vacation of sortedVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      const hasConflict = availableDate <= vacEnd && potentialTaskEnd >= vacStart;

      if (hasConflict) {
        console.log(`   ❌ CONFLICTO DETECTADO:`);
        console.log(`      Tarea: ${availableDate.toISOString()} → ${potentialTaskEnd.toISOString()}`);
        console.log(`      Vacación: ${vacStart.toISOString()} → ${vacEnd.toISOString()}`);

        const dayAfterVacation = new Date(vacEnd);
        dayAfterVacation.setUTCDate(dayAfterVacation.getUTCDate() + 1);
        const newAvailableDate = await getNextAvailableStart(dayAfterVacation);

        console.log(`   🔄 Moviendo tarea a: ${newAvailableDate.toISOString()}`);

        availableDate = newAvailableDate;
        adjusted = true;
        break;
      }
    }
  }

  console.log(`   ✅ Fecha final después de vacaciones: ${availableDate.toISOString()}`);
  return availableDate;
}

// ✅ NUEVA FUNCIÓN: Calcular timing con vacaciones para prioridades
async function calculatePriorityInsertionWithVacations(
  userId: string,
  priority: Priority,
  durationDays: number
): Promise<{
  startDate: Date;
  deadline: Date;
  affectedTasks: any[];
  insertionReason: string;
  vacationAdjustment?: {
    originalDate: Date;
    adjustedDate: Date;
    conflictingVacations: string[];
  };
}> {
  console.log(`\n🏖️ === CALCULANDO INSERCIÓN CON VACACIONES ===`);
  console.log(`👤 Usuario: ${userId}, Prioridad: ${priority}, Duración: ${durationDays} días`);

  // 1. Obtener vacaciones del usuario
  const userWithVacations = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      vacations: {
        where: { endDate: { gte: new Date() } }
      }
    }
  });

  const upcomingVacations: UserVacation[] = userWithVacations?.vacations?.map(v => ({
    id: v.id,
    userId: v.userId,
    startDate: new Date(v.startDate),
    endDate: new Date(v.endDate)
  })) || [];

  console.log(`🏖️ Vacaciones próximas: ${upcomingVacations.length}`);
  upcomingVacations.forEach(vacation => {
    const days = Math.ceil((vacation.endDate.getTime() - vacation.startDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   📅 ${vacation.startDate.toISOString().split('T')[0]} → ${vacation.endDate.toISOString().split('T')[0]} (${days} días)`);
  });

  // 2. Calcular inserción básica según prioridad (sin vacaciones)
  const basicInsertion = await calculatePriorityInsertion(userId, priority, durationDays);

  console.log(`📋 Inserción básica calculada:`);
  console.log(`   Start: ${basicInsertion.startDate.toISOString()}`);
  console.log(`   End: ${basicInsertion.deadline.toISOString()}`);
  console.log(`   Razón: ${basicInsertion.insertionReason}`);

  // 3. Verificar si hay conflictos con vacaciones
  if (upcomingVacations.length === 0) {
    console.log(`✅ Sin vacaciones, usando fechas básicas`);
    return basicInsertion;
  }

  // 4. Ajustar fecha de inicio considerando vacaciones
  const originalStartDate = basicInsertion.startDate;
  const adjustedStartDate = await getNextAvailableStartAfterVacations(
    originalStartDate,
    upcomingVacations,
    durationDays
  );

  // 5. Recalcular deadline con la nueva fecha de inicio
  const taskHours = durationDays * 8;
  const adjustedDeadline = await calculateWorkingDeadline(adjustedStartDate, taskHours);

  // 6. Determinar si hubo ajuste por vacaciones
  const wasAdjusted = adjustedStartDate.getTime() !== originalStartDate.getTime();

  let vacationAdjustment;
  if (wasAdjusted) {
    const conflictingVacations = upcomingVacations
      .filter(vacation => {
        const vacStart = new Date(vacation.startDate);
        const vacEnd = new Date(vacation.endDate);
        return originalStartDate <= vacEnd && basicInsertion.deadline >= vacStart;
      })
      .map(vacation =>
        `${vacation.startDate.toISOString().split('T')[0]} → ${vacation.endDate.toISOString().split('T')[0]}`
      );

    vacationAdjustment = {
      originalDate: originalStartDate,
      adjustedDate: adjustedStartDate,
      conflictingVacations
    };

    console.log(`🏖️ === AJUSTE POR VACACIONES ===`);
    console.log(`📅 Fecha original: ${originalStartDate.toISOString()}`);
    console.log(`📅 Fecha ajustada: ${adjustedStartDate.toISOString()}`);
    console.log(`🏖️ Vacaciones en conflicto: ${conflictingVacations.join(', ')}`);
  }

  return {
    startDate: adjustedStartDate,
    deadline: adjustedDeadline,
    affectedTasks: basicInsertion.affectedTasks,
    insertionReason: wasAdjusted
      ? `${basicInsertion.insertionReason} (ajustado por vacaciones)`
      : basicInsertion.insertionReason,
    vacationAdjustment
  };
}

export async function POST(req: Request) {
  if (!CLICKUP_TOKEN) {
    console.error('ERROR: CLICKUP_API_TOKEN no configurado.')
    return NextResponse.json({ error: 'CLICKUP_API_TOKEN no configurado' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const {
      name,
      description,
      typeId,
      categoryId,
      priority,
      brandId,
      assignedUserIds,
      durationDays
    }: TaskCreationParams = body

    if (!name || !typeId || !categoryId || !priority || !brandId || typeof durationDays !== 'number' || durationDays <= 0) {
      return NextResponse.json({
        error: 'Faltan campos requeridos o duración inválida',
        required: ['name', 'typeId', 'categoryId', 'priority', 'brandId', 'durationDays']
      }, { status: 400 })
    }

    console.log(`🚀 === CREANDO TAREA "${name}" CON VACACIONES ===`)
    console.log(`📋 Parámetros:`)
    console.log(`   - Priority: ${priority}`)
    console.log(`   - Duration: ${durationDays} días`)
    console.log(`   - Type ID: ${typeId}`)
    console.log(`   - Category ID: ${categoryId}`)
    console.log(`   - Brand ID: ${brandId}`)
    console.log(`   - Users: ${assignedUserIds || 'AUTO-ASSIGNMENT'}`)

    const [category, brand] = await Promise.all([
      prisma.taskCategory.findUnique({
        where: { id: categoryId },
        include: {
          type: true,
          tierList: true
        }
      }),
      prisma.brand.findUnique({
        where: { id: brandId }
      })
    ])

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    if (!brand) {
      return NextResponse.json({ error: 'Brand no encontrado' }, { status: 404 })
    }

    console.log(`✅ Categoría: ${category.name} (${category.type.name})`)
    console.log(`✅ Brand: ${brand.name}`)

    const categoryDefaultDuration = category.tierList.duration;
    const userProvidedDuration = durationDays;
    const isCustomDuration = Math.abs(userProvidedDuration - categoryDefaultDuration) > 0.001;

    let usersToAssign: string[] = []

    if (assignedUserIds && assignedUserIds.length > 0) {
      usersToAssign = assignedUserIds
      console.log('👤 Asignación manual de usuarios:', usersToAssign)

      // Validar usuarios
      const specificUsersPromises = usersToAssign.map(userId =>
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            roles: {
              where: {
                OR: [
                  { brandId: brandId },
                  { brandId: null }
                ]
              }
            }
          }
        })
      )

      const specificUsersResults = await Promise.all(specificUsersPromises)

      const validUsers: UserWithRoles[] = specificUsersResults
        .filter((user): user is NonNullable<typeof user> =>
          user !== null &&
          user.active &&
          user.roles.some(role => role.typeId === typeId)
        ) as UserWithRoles[]

      if (validUsers.length === 0) {
        return NextResponse.json({
          error: 'Ninguno de los usuarios especificados es compatible con este tipo de tarea',
          details: 'Verifique que los usuarios existan, estén activos y tengan roles compatibles'
        }, { status: 400 })
      }

      usersToAssign = validUsers.map(user => user.id)
      console.log(`✅ Usuarios válidos para asignación manual: ${usersToAssign.length}`)

    } else {
      console.log('🤖 Iniciando asignación automática...')

      const bestUser = await getBestUserWithCache(typeId, brandId, priority, durationDays)

      if (!bestUser) {
        return NextResponse.json({
          error: 'No se pudo encontrar un diseñador óptimo para la asignación automática',
          details: 'No hay usuarios disponibles que cumplan con los criterios de asignación considerando vacaciones y carga de trabajo'
        }, { status: 400 })
      }

      usersToAssign = [bestUser.userId]
      console.log('✅ Usuario seleccionado automáticamente:', {
        name: bestUser.userName,
        carga: bestUser.cargaTotal,
        disponible: bestUser.availableDate.toISOString(),
        especialista: bestUser.isSpecialist
      })
    }

    // ✅ NUEVA LÓGICA: Calcular fechas CON VACACIONES para cada usuario
    console.log(`\n🏖️ === APLICANDO PRIORIDADES Y VACACIONES ===`)

    const insertionResults = []

    for (const userId of usersToAssign) {
      console.log(`\n👤 Calculando para usuario: ${userId}`)

      const userDuration = durationDays / usersToAssign.length

      // ✅ USAR FUNCIÓN CON VACACIONES
      const insertionResult = await calculatePriorityInsertionWithVacations(
        userId,
        priority,
        userDuration
      )

      insertionResults.push({
        userId,
        ...insertionResult
      })

      console.log(`✅ Resultado para ${userId}:`)
      console.log(`   - Start: ${insertionResult.startDate.toISOString()}`)
      console.log(`   - Deadline: ${insertionResult.deadline.toISOString()}`)
      console.log(`   - Razón: ${insertionResult.insertionReason}`)
      if (insertionResult.vacationAdjustment) {
        console.log(`   - 🏖️ Ajustado por vacaciones: ${insertionResult.vacationAdjustment.conflictingVacations.join(', ')}`)
      }
    }

    // Para múltiples usuarios, usar las fechas más conservadoras
    const finalInsertion = insertionResults.reduce((latest, current) =>
      current.startDate > latest.startDate ? current : latest
    )

    console.log(`\n🎯 === FECHAS FINALES CON VACACIONES ===`)
    console.log(`📅 Fecha de inicio: ${finalInsertion.startDate.toISOString()}`)
    console.log(`📅 Deadline: ${finalInsertion.deadline.toISOString()}`)
    console.log(`💭 Razón: ${finalInsertion.insertionReason}`)

    // ✅ MOSTRAR INFORMACIÓN DE AJUSTES POR VACACIONES
    const vacationAdjustments = insertionResults.filter(r => r.vacationAdjustment)
    if (vacationAdjustments.length > 0) {
      console.log(`\n🏖️ === AJUSTES POR VACACIONES ===`)
      vacationAdjustments.forEach(adj => {
        console.log(`👤 Usuario: ${adj.userId}`)
        console.log(`   📅 Original: ${adj.vacationAdjustment!.originalDate.toISOString()}`)
        console.log(`   📅 Ajustado: ${adj.vacationAdjustment!.adjustedDate.toISOString()}`)
        console.log(`   🏖️ Vacaciones: ${adj.vacationAdjustment!.conflictingVacations.join(', ')}`)
      })
    }

    const categoryForClickUp = {
      ...category,
      type: {
        ...category.type,
        categories: []
      },
      duration: category.tierList.duration,
      tier: category.tierList.name
    }

    const brandForClickUp: ClickUpBrand = {
      ...brand,
      teamId: brand.teamId ?? ''
    }

    console.log('📤 Creando tarea...')

    // Para desarrollo, usar ID temporal
    const clickupTaskId = `vacation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const clickupTaskUrl = `https://vacation-dev.com/task/${clickupTaskId}`

    console.log(`✅ Tarea temporal creada: ${clickupTaskId}`)

    // ✅ CREAR TAREA CON FECHAS QUE CONSIDERAN VACACIONES
    const task = await prisma.task.create({
      data: {
        id: clickupTaskId,
        name,
        description,
        typeId: typeId,
        categoryId: categoryId,
        brandId: brandId,
        priority,
        startDate: finalInsertion.startDate,
        deadline: finalInsertion.deadline,
        url: clickupTaskUrl,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
        // ✅ USAR LA VERIFICACIÓN MEJORADA
        customDuration: isCustomDuration ? userProvidedDuration : null
      },
      include: {
        category: {
          include: {
            type: true,
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
    });

    // Crear asignaciones
    await prisma.taskAssignment.createMany({
      data: usersToAssign.map(userId => ({
        userId: userId,
        taskId: task.id,
      })),
    })

    console.log(`✅ Asignaciones creadas para ${usersToAssign.length} usuarios`)

    // Aplicar recálculo de tareas afectadas
    console.log('🔄 Aplicando recálculo de tareas afectadas...')

    for (const result of insertionResults) {
      if (result.affectedTasks.length > 0) {
        console.log(`   📊 Recalculando ${result.affectedTasks.length} tareas afectadas para usuario ${result.userId}`)
        await shiftTasksAfterInsertion(result.affectedTasks, result.deadline)
        console.log(`   ✅ Recálculo completado para usuario ${result.userId}`)
      }
    }

    // Obtener tarea completa
    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        category: {
          include: {
            type: true,
            tierList: true
          }
        },
        type: true,
        brand: true,
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    try {
      await axios.post(API_CONFIG.SOCKET_EMITTER_URL, {
        eventName: 'task_update',
        data: taskWithAssignees,
      })
      console.log('✅ Evento task_update enviado al socket-emitter.')
    } catch (emitterError) {
      console.error('⚠️ Error al enviar evento a socket-emitter:', emitterError)
    }

    invalidateAllCache()
    console.log('🗑️ Cache invalidado después de crear tarea')

    console.log(`🎉 === TAREA "${name}" CREADA CON VACACIONES EXITOSAMENTE ===`)

    return NextResponse.json({
      id: taskWithAssignees?.id,
      name: taskWithAssignees?.name,
      description: taskWithAssignees?.description,
      status: taskWithAssignees?.status,
      priority: taskWithAssignees?.priority,
      startDate: taskWithAssignees?.startDate.toISOString(),
      deadline: taskWithAssignees?.deadline.toISOString(),
      url: taskWithAssignees?.url,
      createdAt: taskWithAssignees?.createdAt.toISOString(),
      category: {
        id: taskWithAssignees?.category.id,
        name: taskWithAssignees?.category.name,
        duration: taskWithAssignees?.category.tierList.duration,
        tier: taskWithAssignees?.category.tierList.name,
        type: {
          id: taskWithAssignees?.category.type.id,
          name: taskWithAssignees?.category.type.name
        }
      },
      brand: {
        id: taskWithAssignees?.brand.id,
        name: taskWithAssignees?.brand.name
      },
      assignees: taskWithAssignees?.assignees.map(assignment => ({
        userId: assignment.userId,
        user: {
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email
        }
      })) || [],
      vacationInfo: {
        hadVacationConflicts: vacationAdjustments.length > 0,
        adjustments: vacationAdjustments.map(adj => ({
          userId: adj.userId,
          originalStartDate: adj.vacationAdjustment!.originalDate.toISOString(),
          adjustedStartDate: adj.vacationAdjustment!.adjustedDate.toISOString(),
          conflictingVacations: adj.vacationAdjustment!.conflictingVacations
        }))
      },
      priorityDetails: {
        insertionReason: finalInsertion.insertionReason,
        affectedTasksCount: finalInsertion.affectedTasks.length,
        appliedPriorityRules: true,
        appliedVacationLogic: true
      }
    })

  } catch (error) {
    console.error('❌ Error general al crear tarea:', error)

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}