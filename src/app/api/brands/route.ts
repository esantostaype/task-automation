// src/app/api/brands/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        defaultStatus: true,
        spaceId: true,
        folderId: true,
        teamId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}