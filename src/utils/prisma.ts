// utils/prisma.ts - VERSIÓN CONSERVADORA QUE NO ROMPE NADA

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ✅ VERSIÓN CONSERVADORA: Mantener configuración original + mejoras mínimas
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // ✅ Solo logging básico (opcional)
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * ✅ POSTGRESQL: Función helper para obtener timestamp de DB (OPCIONAL)
 * Solo se usa cuando específicamente la llames
 */
export async function getDatabaseTimestamp(): Promise<Date> {
  try {
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW() as now`;
    return new Date(result[0].now);
  } catch (error) {
    console.warn('⚠️ Error obteniendo timestamp de DB, usando local:', error);
    return new Date();
  }
}

/**
 * ✅ POSTGRESQL: Transacción serializable OPCIONAL
 * Solo usar cuando específicamente necesites máxima consistencia
 */
export async function executeSerializableTransaction<T>(
  operation: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Solo configurar isolation level si es PostgreSQL
        if (process.env.PRISMA_DATABASE_URL?.includes('postgresql')) {
          await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
        }
        return await operation(tx);
      },
      {
        maxWait: 5000,  // Reducido a 5 segundos
        timeout: 15000, // Reducido a 15 segundos
      }
    );
  } catch (error) {
    console.error('❌ Error en transacción serializable:', error);
    // Fallback a transacción normal
    return await prisma.$transaction(operation);
  }
}

/**
 * ✅ HELPER: Detectar si estamos usando PostgreSQL
 */
export function isPostgreSQL(): boolean {
  return process.env.PRISMA_DATABASE_URL?.includes('postgresql') ?? false;
}

/**
 * ✅ HELPER: Crear timestamp único solo para PostgreSQL cuando sea necesario
 */
export function createUniqueTimestamp(baseDate?: Date): Date {
  const base = baseDate || new Date();
  
  // Solo agregar variación para PostgreSQL
  if (isPostgreSQL()) {
    const uniqueTime = base.getTime() + Math.floor(Math.random() * 100);
    return new Date(uniqueTime);
  }
  
  return base;
}