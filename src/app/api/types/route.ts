import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'

export async function GET() {
  const types = await prisma.taskType.findMany({
    include: { categories: true }
  })

  return NextResponse.json(types)
}