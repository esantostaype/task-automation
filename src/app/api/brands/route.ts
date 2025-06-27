import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function GET() {
  try {
    const brands = await prisma.brand.findMany();
    return NextResponse.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Error al obtener marcas' }, { status: 500 });
  }
}