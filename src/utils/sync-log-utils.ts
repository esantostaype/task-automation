// lib/sync-log-utils.ts
import { prisma } from '@/utils/prisma';

/**
 * Crea un log de sincronización en la base de datos.
 * @param entityType Tipo de entidad ("Task", "User", "Brand", etc.).
 * @param entityIntId ID de la entidad si es de tipo Int (ej. TaskCategory.id).
 * @param entityStringId ID de la entidad si es de tipo String (ej. User.id, Task.id, Brand.id).
 * @param action Acción realizada ("CREATE", "UPDATE", "DELETE").
 * @param status Estado de la operación ("SUCCESS", "ERROR").
 * @param errorMessage Mensaje de error (opcional).
 * @param clickupResponse Respuesta completa de ClickUp (opcional).
 */
export async function createSyncLog(
  entityType: string,
  entityIntId: number | null,
  entityStringId: string | null,
  action: string,
  status: string,
  errorMessage?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clickupResponse?: any
) {
  try {
    await prisma.syncLog.create({
      data: {
        entityType,
        entityIntId,
        entityStringId,
        action,
        status,
        errorMessage,
        clickupResponse: clickupResponse ? clickupResponse : undefined
      }
    });
  } catch (error) {
    console.error('Error creating sync log:', error);
  }
}
