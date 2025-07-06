// src/app/api/categories/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Tier } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const { name, duration, tier, typeId } = await req.json();

    // Validar campos requeridos
    if (!name || typeof duration !== 'number' || duration <= 0 || !tier || !typeId) {
      return NextResponse.json({
        error: 'Faltan campos requeridos o inválidos para crear la categoría.',
        required: ['name', 'duration', 'tier', 'typeId']
      }, { status: 400 });
    }

    // Validar que el tier sea uno de los valores válidos del enum
    const validTiers = Object.values(Tier);
    if (!validTiers.includes(tier)) {
      return NextResponse.json({
        error: `El tier proporcionado no es válido. Valores permitidos: ${validTiers.join(', ')}`,
      }, { status: 400 });
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
        duration,
        tier,
        typeId,
      },
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

// Puedes añadir un GET para listar todas las categorías si lo necesitas
export async function GET() {
  try {
    const categories = await prisma.taskCategory.findMany({
      include: { type: true } // Incluye el tipo para poder filtrar por UX/UI o Graphic
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 });
  }
}