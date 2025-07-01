// src/services/optimizedDataFetcher.service.ts
import { prisma } from '@/utils/prisma'; // Importa tu instancia de Prisma
import { Status } from '@prisma/client'; // Para filtrar por estados de tarea
import { User, UserRole, Task, TaskCategory, TaskType, Brand, TaskAssignment } from '@/interfaces'; // Importa las interfaces necesarias

// Definimos una interfaz mínima para TaskType cuando se incluye a través de UserRole.
// Esto se debe a que Prisma, por defecto, solo trae los campos escalares (id, name)
// y no las relaciones (como 'categories') al hacer un `include: { type: true }` anidado.
export interface MinimalTaskType {
  id: number;
  name: string;
}

// Definimos una interfaz extendida para el usuario, que incluirá todos los datos cargados.
// Esto mejora la legibilidad y el tipado del código.
export interface UserWithOptimizedData extends User {
  // Corrección: Usamos MinimalTaskType aquí para que coincida con lo que Prisma devuelve.
  roles: (UserRole & { type: MinimalTaskType | null })[]; // Roles del usuario, incluyendo el tipo de rol (minimal)
  // El modelo User tiene una relación 'tasks' que es un array de TaskAssignment.
  // Dentro de TaskAssignment, se relaciona con el modelo Task a través de 'task'.
  tasks: (TaskAssignment & {
    task: Task & { // Incluye el modelo Task real
      category: TaskCategory; // Incluye la categoría de la tarea
      type: TaskType;       // Incluye el tipo de tarea (aquí sí se espera el tipo completo)
      brand: Brand;         // Incluye la marca de la tarea
      assignees: (TaskAssignment & { user: User })[]; // Incluye los asignados de la tarea con sus datos de usuario
    };
  })[];
  // performanceMetrics?: any; // Comentado, ya que no implementaremos métricas por ahora
}

/**
 * Obtiene todos los usuarios activos junto con sus roles, tareas asignadas (filtradas por tipo y marca),
 * y los detalles completos de esas tareas (categoría, tipo, marca, otros asignados).
 * Esto se hace en una sola consulta optimizada a la base de datos.
 *
 * @param typeId El ID del tipo de tarea para filtrar las tareas asignadas.
 * @param brandId El ID de la marca para filtrar las tareas asignadas.
 * @returns Un array de objetos UserWithOptimizedData.
 */
export async function getOptimizedUserData(typeId: number, brandId: string): Promise<UserWithOptimizedData[]> {
  const users = await prisma.user.findMany({
    where: { active: true }, // Solo usuarios activos
    include: {
      roles: {
        where: {
          OR: [
            { brandId: brandId }, // Roles específicos de la marca
            { brandId: null }    // Roles globales (sin marca específica)
          ]
        },
        include: { type: true } // Incluir el tipo asociado al rol (aquí Prisma solo trae id y name)
      },
      // Corrección: Usar 'tasks' (la relación en el modelo User) y luego anidar 'task'
      tasks: { // Esto se refiere a la relación 'tasks' en el modelo User (que es TaskAssignment[])
        where: {
          // Filtra las tareas a través de la relación TaskAssignment
          task: { // Filtra el modelo Task real
            status: {
              notIn: [Status.COMPLETE], // Ajusta esto si tienes más estados "finales"
            },
            typeId: typeId,
            brandId: brandId,
          },
        },
        include: {
          task: { // Incluye el modelo Task real y sus relaciones anidadas
            include: {
              category: true, // Incluir la categoría de la tarea
              type: true,     // Incluir el tipo de la tarea (aquí se espera el tipo completo)
              brand: true,    // Incluir la marca de la tarea
              assignees: {    // Incluir otros asignados a la misma tarea
                include: { user: true } // Detalle del usuario asignado
              }
            }
          }
        },
        // Corrección: Ordenar por la propiedad 'queuePosition' del modelo 'task' anidado
        orderBy: { task: { queuePosition: 'asc' } } // Mantener el orden de la cola
      },
      // performanceMetrics: true, // No incluir por ahora, según tu indicación
    },
  });

  // El casteo es necesario porque TypeScript no puede inferir completamente las relaciones anidadas
  // de Prisma en tiempo de compilación para una interfaz tan profunda.
  return users as unknown as UserWithOptimizedData[];
}
