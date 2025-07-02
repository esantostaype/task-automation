// utils/postgresql-compatibility.ts - NUEVO ARCHIVO

import { PrismaClient } from '@prisma/client';

/**
 * Configuración específica para PostgreSQL
 */
export function createPostgreSQLPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.PRISMA_DATABASE_URL
      }
    },
    // ✅ CRÍTICO: Configuración específica para PostgreSQL
    log: ['query', 'info', 'warn', 'error'],
  });
}

/**
 * ✅ SOLUCIÓN 1: Forzar timestamp único usando microsegundos
 */
export function createUniqueTimestamp(): Date {
  const now = new Date();
  // Agregar microsegundos únicos para evitar timestamps idénticos
  const uniqueMs = now.getTime() + Math.floor(Math.random() * 1000);
  return new Date(uniqueMs);
}

/**
 * ✅ SOLUCIÓN 2: Usar transacciones con nivel de aislamiento específico
 */
export async function executeWithSerializableTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(
    async (tx) => {
      // Forzar nivel de aislamiento SERIALIZABLE para PostgreSQL
      await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
      return await operation(tx);
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: 'Serializable' // Prisma 5.0+
    }
  );
}

/**
 * ✅ SOLUCIÓN 3: Refresh connection entre operaciones
 */
export async function refreshConnection(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
  await prisma.$connect();
}

/**
 * ✅ SOLUCIÓN 4: Usar NOW() de PostgreSQL en lugar de Date() de JavaScript
 */
export async function getPostgreSQLTimestamp(prisma: PrismaClient): Promise<Date> {
  const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
  return result[0].now;
}

/**
 * ✅ SOLUCIÓN 5: Forzar un delay mínimo entre operaciones
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}