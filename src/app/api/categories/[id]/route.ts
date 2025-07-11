import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, tierId, typeId } = body;

    // Validación básica
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id: Number(id) }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Si se proporciona tierId, validar que existe
    if (tierId) {
      const existingTier = await prisma.tierList.findUnique({
        where: { id: tierId },
      });

      if (!existingTier) {
        return NextResponse.json(
          { error: 'Tier not found' },
          { status: 404 }
        );
      }
    }

    // Si se proporciona typeId, validar que existe
    if (typeId) {
      const existingType = await prisma.taskType.findUnique({
        where: { id: typeId },
      });

      if (!existingType) {
        return NextResponse.json(
          { error: 'Task type not found' },
          { status: 404 }
        );
      }
    }

    // Actualizar la categoría
    const updatedCategory = await prisma.taskCategory.update({
      where: { id: Number(id) },
      data: {
        name: name.trim(),
        ...(tierId && { tierId }),
        ...(typeId && { typeId }),
      },
      include: {
        tierList: true,
        type: true
      }
    });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    
    // Manejar error de duplicado
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Verificar que la categoría existe
    const existingCategory = await prisma.taskCategory.findUnique({
      where: { id: Number(id) },
      include: {
        tasks: true // Para verificar si tiene tareas asociadas
      }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Verificar si tiene tareas asociadas
    if (existingCategory.tasks && existingCategory.tasks.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with associated tasks' },
        { status: 400 }
      );
    }

    // Eliminar la categoría
    await prisma.taskCategory.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}