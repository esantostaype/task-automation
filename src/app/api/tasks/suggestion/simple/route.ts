// src/app/api/tasks/suggestion/simple/route.ts
import { NextResponse } from 'next/server';
import { getBestUserWithCache } from '@/services/task-assignment.service';
import { prisma } from '@/utils/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const typeId = parseInt(searchParams.get('typeId') || '0');
    const durationDays = parseFloat(searchParams.get('durationDays') || '0');
    const brandId = searchParams.get('brandId'); // ✅ OPCIONAL

    // ✅ VALIDACIÓN SOLO DE PARÁMETROS ESENCIALES
    if (!typeId || typeId <= 0) {
      return NextResponse.json({ 
        error: 'typeId es requerido y debe ser un número válido mayor a 0',
        received: typeId
      }, { status: 400 });
    }

    if (!durationDays || durationDays <= 0) {
      return NextResponse.json({ 
        error: 'durationDays es requerido y debe ser un número mayor a 0',
        received: durationDays
      }, { status: 400 });
    }

    console.log(`🔍 === SUGERENCIA FLEXIBLE ===`);
    console.log(`📋 Parámetros:`);
    console.log(`   - Type ID: ${typeId}`);
    console.log(`   - Duration Days: ${durationDays}`);
    console.log(`   - Brand ID: ${brandId || 'global (all brands)'}`);

    // ✅ LÓGICA FLEXIBLE: Usar brandId si está disponible, sino buscar globalmente
    let bestSlot;
    
    if (brandId) {
      // Con brand específico
      console.log(`🎯 Buscando usuario para brand específico: ${brandId}`);
      bestSlot = await getBestUserWithCache(
        typeId, 
        brandId, 
        'NORMAL', // Priority fija
        durationDays
      );
    } else {
      // ✅ FALLBACK: Buscar en todos los brands activos
      console.log(`🌍 Buscando usuario globalmente (sin brand específico)`);
      
      // Obtener todos los brands activos
      const activeBrands = await prisma.brand.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });

      console.log(`📊 Brands activos encontrados: ${activeBrands.length}`);

      // Intentar con cada brand hasta encontrar un usuario
      for (const brand of activeBrands) {
        console.log(`   🔍 Intentando con brand: ${brand.name} (${brand.id})`);
        
        const candidateSlot = await getBestUserWithCache(
          typeId, 
          brand.id, 
          'NORMAL',
          durationDays
        );

        if (candidateSlot) {
          bestSlot = candidateSlot;
          console.log(`   ✅ Usuario encontrado en brand: ${brand.name}`);
          break;
        }
      }
    }

    if (!bestSlot) {
      console.log('❌ No se encontró usuario óptimo en ningún brand');
      
      return NextResponse.json({ 
        error: 'No se pudo encontrar un diseñador óptimo',
        details: brandId 
          ? `No hay usuarios disponibles para el brand ${brandId}` 
          : 'No hay usuarios disponibles en ningún brand activo'
      }, { status: 400 });
    }

    console.log(`✅ Sugerencia generada:`);
    console.log(`   👤 Usuario: ${bestSlot.userName} (ID: ${bestSlot.userId})`);
    console.log(`   📊 Carga actual: ${bestSlot.cargaTotal} tareas`);
    console.log(`   📅 Disponible desde: ${bestSlot.availableDate.toISOString()}`);
    console.log(`   🎯 Es especialista: ${bestSlot.isSpecialist ? 'Sí' : 'No'}`);

    // ✅ RESPUESTA EXITOSA
    return NextResponse.json({
      suggestedUserId: bestSlot.userId,
      userInfo: {
        id: bestSlot.userId,
        name: bestSlot.userName,
        currentLoad: bestSlot.cargaTotal,
        isSpecialist: bestSlot.isSpecialist,
        availableFrom: bestSlot.availableDate.toISOString(),
        totalAssignedDurationDays: bestSlot.totalAssignedDurationDays
      },
      metadata: {
        typeId: typeId,
        durationDays: durationDays,
        brandId: brandId || 'global',
        generatedAt: new Date().toISOString(),
        algorithm: 'duration-balanced-assignment-flexible'
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener sugerencia flexible:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor al obtener sugerencia',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}