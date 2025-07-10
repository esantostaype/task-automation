import { NextResponse } from 'next/server'
import { prisma } from '@/utils/prisma'

export async function GET() {
  const types = await prisma.taskType.findMany({
    include: {
      categories: {
        include: {
          tierList: true  // ✅ ASEGÚRATE de que esto esté incluido
        }
      }
    }
  })

  return NextResponse.json(types)
}