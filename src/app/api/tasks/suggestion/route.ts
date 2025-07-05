// src/app/api/tasks/suggestion/route.ts - VERSIÓN FINAL CON LÓGICA DE VACACIONES

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

    console.log(`🔍 === GENERANDO SUGERENCIA CON LÓGICA DE VACACIONES ===`);
    console.log(`📋 Parámetros de entrada:`);
    console.log(`   - Brand ID: ${brandId}`);
    console.log(`   - Category ID: ${categoryId}`);
    console.log(`   - Priority: ${priority}`);

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
    console.log(`   - Duración: ${category.duration} días`);
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

    // ===== OBTENER SUGERENCIA CON LÓGICA DE VACACIONES =====
    console.log(`🤖 Buscando mejor usuario con lógica de vacaciones...`);
    
    const bestSlot = await getBestUserWithCache(
      category.type.id, 
      brandId, 
      priority, 
      category.duration // ✅ Pasar duración para activar lógica de vacaciones
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
          priority: priority
        }
      }, { status: 400 });
    }

    // ===== CALCULAR INFORMACIÓN ADICIONAL =====
    const estimatedDurationHours = category.duration * 8; // Convertir días a horas
    const estimatedDurationDays = category.duration;

    // Calcular fecha estimada de finalización
    const estimatedEndDate = new Date(bestSlot.availableDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + Math.ceil(estimatedDurationDays));

    console.log(`✅ Sugerencia generada exitosamente:`);
    console.log(`   👤 Usuario sugerido: ${bestSlot.userName} (ID: ${bestSlot.userId})`);
    console.log(`   📊 Carga actual: ${bestSlot.cargaTotal} tareas`);
    console.log(`   📅 Disponible desde: ${bestSlot.availableDate.toISOString()}`);
    console.log(`   🎯 Es especialista: ${bestSlot.isSpecialist ? 'Sí' : 'No'}`);
    console.log(`   ⏰ Duración estimada: ${estimatedDurationHours} horas (${estimatedDurationDays} días)`);
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
        currentLoad: bestSlot.cargaTotal,
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        estimatedStartDate: bestSlot.availableDate.toISOString(),
        estimatedEndDate: estimatedEndDate.toISOString(),
        lastTaskDeadline: bestSlot.lastTaskDeadline?.toISOString() || null
      },
      
      // Información de la categoría
      categoryInfo: {
        id: category.id,
        name: category.name,
        duration: category.duration,
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
        algorithm: 'vacation-aware-assignment'
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