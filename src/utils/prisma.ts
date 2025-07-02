import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function getDatabaseTimestamp(): Promise<Date> {
  try {
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`
    return new Date(result[0].now)
  } catch (error) {
    console.warn('⚠️ Error obteniendo timestamp de DB, usando local:', error)
    return new Date()
  }
}

export async function executeSerializableTransaction<T>(
  operation: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        if (process.env.PRISMA_DATABASE_URL?.includes('postgresql')) {
          await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        }
        return await operation(tx)
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    )
  } catch (error) {
    console.error('❌ Error en transacción serializable:', error)
    // Fallback a transacción normal
    return await prisma.$transaction(operation)
  }
}

export function isPostgreSQL(): boolean {
  return process.env.PRISMA_DATABASE_URL?.includes('postgresql') ?? false
}

export function createUniqueTimestamp(baseDate?: Date): Date {
  const base = baseDate || new Date()
  
  if (isPostgreSQL()) {
    const uniqueTime = base.getTime() + Math.floor(Math.random() * 100)
    return new Date(uniqueTime)
  }
  
  return base
}