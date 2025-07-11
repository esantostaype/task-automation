import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function POST(req: Request) {
  try {
    const { name, tierId, typeId } = await req.json();

    // Validar campos requeridos
    if (!name || !tierId || !typeId) {
      return NextResponse.json(
        { error: 'Name, tierId, and typeId are required' },
        { status: 400 }
      );
    }

    // Validar que el tier exista
    const existingTier = await prisma.tierList.findUnique({
      where: { id: tierId },
    });

    if (!existingTier) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      );
    }

    // Validar que el type exista
    const existingType = await prisma.taskType.findUnique({
      where: { id: typeId },
    });

    if (!existingType) {
      return NextResponse.json(
        { error: 'Task type not found' },
        { status: 404 }
      );
    }

    const newCategory = await prisma.taskCategory.create({
      data: {
        name: name.trim(),
        tierId,
        typeId,
      },
      include: {
        tierList: true,
        type: true
      }
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Manejar error de duplicado
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const categories = await prisma.taskCategory.findMany({
      include: { 
        type: true,
        tierList: true
      }
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}