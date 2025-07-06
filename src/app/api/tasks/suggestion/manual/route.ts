// src/app/api/tasks/suggestion/manual/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getBestUserWithCache } from '@/services/task-assignment.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const typeId = parseInt(searchParams.get('typeId') || '0');
    const priority = searchParams.get('priority') as Priority;
    const durationDays = parseFloat(searchParams.get('durationDays') || '0');

    // Validar parámetros requeridos
    if (!brandId || !typeId || !priority || !durationDays) {
      return NextResponse.json({ 
        error: 'Faltan parámetros requeridos',
        required: ['brandId', 'typeId', 'priority', 'durationDays'],
        received: {
          brandId: brandId || 'missing',
          typeId: typeId || 'missing',
          priority: priority || 'missing',
          durationDays: durationDays || 'missing'
        }
      }, { status: 400 });
    }

    // Validar prioridad
    const validPriorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ 
        error: 'Prioridad inválida',
        validPriorities,
        received: priority
      }, { status: 400 });
    }

    console.log(`🔍 === GENERANDO SUGERENCIA PARA NUEVA CATEGORÍA MANUAL ===`);
    console.log(`📋 Parámetros de entrada:`);
    console.log(`   - Brand ID: ${brandId}`);
    console.log(`   - Type ID: ${typeId}`);
    console.log(`   - Priority: ${priority}`);
    console.log(`   - Duration Days: ${durationDays}`);

    // Verificar que el tipo existe
    const taskType = await prisma.taskType.findUnique({
      where: { id: typeId },
      select: { id: true, name: true }
    });

    if (!taskType) {
      return NextResponse.json({ 
        error: 'Tipo de tarea no encontrado',
        typeId: typeId
      }, { status: 404 });
    }

    console.log(`✅ Tipo encontrado: ${taskType.name}`);

    // Verificar que el brand existe
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, isActive: true }
    });

    if (!brand) {
      return NextResponse.json({ 
        error: 'Brand no encontrado',
        brandId: brandId
      }, { status: 404 });
    }

    if (!brand.isActive) {
      return NextResponse.json({ 
        error: 'Brand no está activo',
        brandId: brandId,
        brandName: brand.name
      }, { status: 400 });
    }

    console.log(`✅ Brand encontrado: ${brand.name} (activo)`);

    // ===== OBTENER SUGERENCIA CON LÓGICA DE VACACIONES =====
    console.log(`🤖 Buscando mejor usuario para nueva categoría con duración manual...`);
    
    const bestSlot = await getBestUserWithCache(
      typeId, 
      brandId, 
      priority, 
      durationDays // ✅ Usar la duración manual proporcionada
    );

    if (!bestSlot) {
      console.log('❌ No se encontró diseñador óptimo para la nueva categoría manual');
      
      // Intentar obtener información de por qué no hay usuarios disponibles
      const compatibleUsersCount = await prisma.user.count({
        where: {
          active: true,
          roles: {
            some: {
              typeId: typeId,
              OR: [
                { brandId: brandId },
                { brandId: null }
              ]
            }
          }
        }
      });

      return NextResponse.json({ 
        error: 'No se pudo encontrar un diseñador óptimo para la asignación automática',
        details: 'No hay usuarios disponibles que cumplan con los criterios de asignación considerando vacaciones y carga de trabajo',
        diagnostics: {
          compatibleUsersTotal: compatibleUsersCount,
          typeRequired: taskType.name,
          brandId: brandId,
          priority: priority,
          durationDays: durationDays
        }
      }, { status: 400 });
    }

    // ===== CALCULAR INFORMACIÓN ADICIONAL =====
    const estimatedDurationHours = durationDays * 8; // Convertir días a horas

    // Calcular fecha estimada de finalización
    const estimatedEndDate = new Date(bestSlot.availableDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + Math.ceil(durationDays));

    console.log(`✅ Sugerencia generada exitosamente para nueva categoría manual:`);
    console.log(`   👤 Usuario sugerido: ${bestSlot.userName} (ID: ${bestSlot.userId})`);
    console.log(`   📊 Carga actual: ${bestSlot.cargaTotal} tareas`);
    console.log(`   📅 Disponible desde: ${bestSlot.availableDate.toISOString()}`);
    console.log(`   🎯 Es especialista: ${bestSlot.isSpecialist ? 'Sí' : 'No'}`);
    console.log(`   ⏰ Duración manual: ${estimatedDurationHours} horas (${durationDays} días)`);
    console.log(`   📆 Fecha estimada de fin: ${estimatedEndDate.toISOString()}`);

    // ===== RESPUESTA EXITOSA =====
    return NextResponse.json({
      // Campos principales (compatibilidad con frontend existente)
      suggestedUserId: bestSlot.userId,
      estimatedDurationHours: estimatedDurationHours,
      
      // Información extendida
      suggestion: {
        userId: bestSlot.userId,
        estimatedDurationHours: estimatedDurationHours,
        estimatedDurationDays: durationDays
      },
      
      // Información del usuario sugerido
      userInfo: {
        id: bestSlot.userId,
        name: bestSlot.userName,
        currentLoad: bestSlot.cargaTotal,
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        estimatedStartDate: bestSlot.availableDate.toISOString(),
        estimatedEndDate: estimatedEndDate.toISOString(),
        lastTaskDeadline: bestSlot.lastTaskDeadline?.toISOString() || null
      },
      
      // Información del tipo
      typeInfo: {
        id: taskType.id,
        name: taskType.name
      },
      
      // Información del brand
      brandInfo: {
        id: brand.id,
        name: brand.name,
        isActive: brand.isActive
      },
      
      // Metadatos de la sugerencia
      metadata: {
        priority: priority,
        manualDuration: durationDays,
        generatedAt: new Date().toISOString(),
        consideresVacations: true,
        considersHolidays: true,
        considersWorkload: true,
        algorithm: 'vacation-aware-assignment-manual'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener sugerencia manual:', error);
    
    // Log detallado del error para debugging
    if (error instanceof Error) {
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    }

    return NextResponse.json({
      error: 'Error interno del servidor al obtener sugerencia manual',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}