// src/app/api/categories/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function POST(req: Request) {
  try {
    const { name, tierId, typeId } = await req.json();

    // Validar campos requeridos
    if (!name || !tierId || !typeId) {
      return NextResponse.json({
        error: 'Faltan campos requeridos para crear la categoría.',
        required: ['name', 'tierId', 'typeId']
      }, { status: 400 });
    }

    // Validar que el tierId exista
    const existingTier = await prisma.tierList.findUnique({
      where: { id: tierId },
    });

    if (!existingTier) {
      return NextResponse.json({ error: 'Tier (tierId) no encontrado.' }, { status: 404 });
    }

    // Validar que el typeId exista
    const existingType = await prisma.taskType.findUnique({
      where: { id: typeId },
    });

    if (!existingType) {
      return NextResponse.json({ error: 'Tipo de tarea (typeId) no encontrado.' }, { status: 404 });
    }

    const newCategory = await prisma.taskCategory.create({
      data: {
        name,
        tierId,
        typeId,
      },
      include: {
        tierList: true,
        type: true
      }
    });

    console.log(`✅ Nueva categoría creada: ${newCategory.name} (ID: ${newCategory.id})`);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('❌ Error al crear la categoría:', error);
    return NextResponse.json({
      error: 'Error interno del servidor al crear la categoría',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const categories = await prisma.taskCategory.findMany({
      include: { 
        type: true,
        tierList: true // Incluir TierList para acceder a duration y tier name
      }
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}