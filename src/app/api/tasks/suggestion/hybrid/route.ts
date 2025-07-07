// src/app/api/tasks/suggestion/route.ts - VERSIÓN CON SOPORTE PARA DURACIÓN MANUAL

import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Priority } from '@prisma/client';
import { getBestUserWithCache } from '@/services/task-assignment.service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const categoryId = parseInt(searchParams.get('categoryId') || '0');
    const priority = searchParams.get('priority') as Priority;
    // ✅ NUEVO: Soporte para duración manual
    const manualDuration = searchParams.get('manualDuration');

    // Validar parámetros requeridos
    if (!brandId || !categoryId || !priority) {
      return NextResponse.json({ 
        error: 'Faltan parámetros requeridos',
        required: ['brandId', 'categoryId', 'priority'],
        received: {
          brandId: brandId || 'missing',
          categoryId: categoryId || 'missing',
          priority: priority || 'missing'
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

    console.log(`🔍 === GENERANDO SUGERENCIA ${manualDuration ? 'CON DURACIÓN MANUAL' : 'ESTÁNDAR'} ===`);
    console.log(`📋 Parámetros de entrada:`);
    console.log(`   - Brand ID: ${brandId}`);
    console.log(`   - Category ID: ${categoryId}`);
    console.log(`   - Priority: ${priority}`);
    console.log(`   - Manual Duration: ${manualDuration || 'No especificada'}`);

    // Obtener categoría con tipo
    const category = await prisma.taskCategory.findUnique({
      where: { id: categoryId },
      include: { type: true },
    });

    if (!category) {
      return NextResponse.json({ 
        error: 'Categoría no encontrada',
        categoryId: categoryId
      }, { status: 404 });
    }

    console.log(`✅ Categoría encontrada:`);
    console.log(`   - Nombre: ${category.name}`);
    console.log(`   - Tipo: ${category.type.name}`);
    console.log(`   - Duración original: ${category.duration} días`);
    console.log(`   - Tier: ${category.tier}`);

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

    // ✅ LÓGICA HÍBRIDA: Determinar duración a usar
    let effectiveDuration: number;
    let durationSource: string;

    if (manualDuration) {
      const parsedManualDuration = parseFloat(manualDuration);
      if (parsedManualDuration > 0) {
        effectiveDuration = parsedManualDuration;
        durationSource = 'manual';
        console.log(`🔧 Usando duración MANUAL: ${effectiveDuration} días`);
      } else {
        effectiveDuration = category.duration;
        durationSource = 'category';
        console.log(`⚠️ Duración manual inválida, usando duración de categoría: ${effectiveDuration} días`);
      }
    } else {
      effectiveDuration = category.duration;
      durationSource = 'category';
      console.log(`📋 Usando duración de CATEGORÍA: ${effectiveDuration} días`);
    }

    // ===== OBTENER SUGERENCIA CON LÓGICA DE VACACIONES =====
    console.log(`🤖 Buscando mejor usuario con lógica de vacaciones...`);
    
    const bestSlot = await getBestUserWithCache(
      category.type.id, 
      brandId, 
      priority, 
      effectiveDuration // ✅ Usar duración efectiva (manual o de categoría)
    );

    if (!bestSlot) {
      console.log('❌ No se encontró diseñador óptimo para la sugerencia');
      
      // Intentar obtener información de por qué no hay usuarios disponibles
      const compatibleUsersCount = await prisma.user.count({
        where: {
          active: true,
          roles: {
            some: {
              typeId: category.type.id,
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
          typeRequired: category.type.name,
          brandId: brandId,
          priority: priority,
          effectiveDuration: effectiveDuration,
          durationSource: durationSource
        }
      }, { status: 400 });
    }

    // ===== CALCULAR INFORMACIÓN ADICIONAL =====
    const estimatedDurationHours = effectiveDuration * 8; // Convertir días a horas
    const estimatedDurationDays = effectiveDuration;

    // Calcular fecha estimada de finalización
    const estimatedEndDate = new Date(bestSlot.availableDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + Math.ceil(estimatedDurationDays));

    console.log(`✅ Sugerencia generada exitosamente:`);
    console.log(`   👤 Usuario sugerido: ${bestSlot.userName} (ID: ${bestSlot.userId})`);
    console.log(`   📊 Carga actual: ${bestSlot.totalAssignedDurationDays} días totales`);
    console.log(`   📅 Disponible desde: ${bestSlot.availableDate.toISOString()}`);
    console.log(`   🎯 Es especialista: ${bestSlot.isSpecialist ? 'Sí' : 'No'}`);
    console.log(`   ⏰ Duración efectiva: ${estimatedDurationHours} horas (${estimatedDurationDays} días)`);
    console.log(`   📝 Fuente de duración: ${durationSource}`);
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
        estimatedDurationDays: estimatedDurationDays
      },
      
      // Información del usuario sugerido
      userInfo: {
        id: bestSlot.userId,
        name: bestSlot.userName,
        currentLoad: bestSlot.cargaTotal, // Número de tareas
        currentDurationLoad: bestSlot.totalAssignedDurationDays, // ✅ NUEVO: Carga en días
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        estimatedStartDate: bestSlot.availableDate.toISOString(),
        estimatedEndDate: estimatedEndDate.toISOString(),
        lastTaskDeadline: bestSlot.lastTaskDeadline?.toISOString() || null
      },
      
      // Información de la categoría y duración
      categoryInfo: {
        id: category.id,
        name: category.name,
        originalDuration: category.duration, // Duración original de la categoría
        effectiveDuration: effectiveDuration, // Duración efectiva usada
        durationSource: durationSource, // 'manual' o 'category'
        tier: category.tier,
        type: {
          id: category.type.id,
          name: category.type.name
        }
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
        generatedAt: new Date().toISOString(),
        consideresVacations: true,
        considersHolidays: true,
        considersWorkload: true,
        considersDurationBalance: true, // ✅ NUEVO
        algorithm: 'vacation-aware-assignment-with-duration-balance',
        hasManualDuration: !!manualDuration
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener sugerencia:', error);
    
    // Log detallado del error para debugging
    if (error instanceof Error) {
      console.error(`   - Message: ${error.message}`);
      console.error(`   - Stack: ${error.stack}`);
    }

    return NextResponse.json({
      error: 'Error interno del servidor al obtener sugerencia',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}