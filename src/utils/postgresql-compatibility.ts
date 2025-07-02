import { PrismaClient } from '@prisma/client'

export function createPostgreSQLPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.PRISMA_DATABASE_URL
      }
    },
    log: ['query', 'info', 'warn', 'error'],
  })
}

export function createUniqueTimestamp(): Date {
  const now = new Date()
  const uniqueMs = now.getTime() + Math.floor(Math.random() * 1000)
  return new Date(uniqueMs)
}

export async function executeWithSerializableTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return await operation(tx)
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: 'Serializable'
    }
  )
}

export async function refreshConnection(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect()
  await prisma.$connect()
}

export async function getPostgreSQLTimestamp(prisma: PrismaClient): Promise<Date> {
  const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`
  return result[0].now
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}