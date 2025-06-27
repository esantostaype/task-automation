// app/api/tasks/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/utils/prisma';
import { Status, Priority } from '@prisma/client'; // Importar enums para tipado
import type { Server as HTTPServer } from 'http'; 
import type { Socket as NetSocket } from 'net';     
import { Server as SocketIOServer } from 'socket.io'; 

// Define la interfaz para el servidor de Socket.IO en el objeto de respuesta
interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

// Extendemos el tipo Request de Next.js para incluir la propiedad socket
interface AppRouterRequest extends Request {
  socket: SocketWithIO;
}

// Interfaz para los parámetros de la ruta dinámica
interface TaskRouteParams {
  params: {
    id: string; // El ID de la tarea (que es el ClickUp ID, de tipo String)
  };
}

// Interfaz para el cuerpo de la solicitud PUT
interface UpdateTaskRequestBody {
  name?: string;
  description?: string | null;
  status?: Status;
  priority?: Priority;
  startDate?: string; // Se espera un string de fecha, que será parseado a Date
  deadline?: string;  // Se espera un string de fecha, que será parseado a Date
  url?: string | null;
  assignedUserIds?: string[]; // Array de IDs de usuario (String)
}

/**
 * Maneja las solicitudes GET para obtener una tarea por su ID.
 * @param req Objeto de solicitud.
 * @param params Parámetros de la ruta dinámica (contiene el ID de la tarea).
 * @returns Respuesta JSON con la tarea o un error.
 */
export async function GET(req: Request, { params }: TaskRouteParams) {
  try {
    const { id } = params; // El ID de la tarea es un String (ClickUp ID)

    const task = await prisma.task.findUnique({
      where: { id: id }, // Buscar por el ID de ClickUp
      include: {
        category: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task by ID:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * Maneja las solicitudes PUT para actualizar una tarea por su ID.
 * @param req Objeto de solicitud.
 * @param params Parámetros de la ruta dinámica (contiene el ID de la tarea).
 * @returns Respuesta JSON con la tarea actualizada o un error.
 */
export async function PUT(req: AppRouterRequest, { params }: TaskRouteParams) {
  try {
    const { id } = params; // El ID de la tarea es un String (ClickUp ID)
    const body: UpdateTaskRequestBody = await req.json(); // Usar la interfaz para el cuerpo
    const { 
      name, 
      description, 
      status, 
      priority, 
      startDate, 
      deadline, 
      url, 
      assignedUserIds 
    } = body;

    const existingTask = await prisma.task.findUnique({
      where: { id: id },
      include: { assignees: true } // Incluir asignaciones existentes para compararlas
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Preparar los datos para la actualización
    const updateData: {
      name?: string;
      description?: string | null;
      status?: Status;
      priority?: Priority;
      startDate?: Date;
      deadline?: Date;
      url?: string | null;
      lastSyncAt: Date;
      syncStatus: string;
    } = {
      name: name ?? existingTask.name,
      description: description ?? existingTask.description,
      status: status ?? existingTask.status, // Usar ?? para mantener el valor existente si es undefined
      priority: priority ?? existingTask.priority, // Usar ??
      startDate: startDate ? new Date(startDate) : existingTask.startDate,
      deadline: deadline ? new Date(deadline) : existingTask.deadline,
      url: url ?? existingTask.url,
      lastSyncAt: new Date(), // Actualizar timestamp de sincronización
      syncStatus: 'SYNCED', // Asumimos que la actualización local es una sincronización
    };

    // Actualizar la tarea en la base de datos
    const updatedTask = await prisma.task.update({
      where: { id: id },
      data: updateData,
      include: {
        category: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      },
    });

    // Manejar la actualización de asignaciones si se proporcionan
    if (assignedUserIds !== undefined && Array.isArray(assignedUserIds)) {
      // Eliminar asignaciones antiguas
      await prisma.taskAssignment.deleteMany({
        where: { taskId: updatedTask.id },
      });

      // Crear nuevas asignaciones
      if (assignedUserIds.length > 0) {
        await prisma.taskAssignment.createMany({
          data: assignedUserIds.map((userId: string) => ({
            taskId: updatedTask.id,
            userId: userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Recargar la tarea con las asignaciones actualizadas para la respuesta
    const taskWithUpdatedAssignees = await prisma.task.findUnique({
      where: { id: updatedTask.id },
      include: {
        category: true,
        type: true,
        brand: true,
        assignees: {
          include: {
            user: true
          }
        }
      },
    });

    // Emitir evento de Socket.IO para notificar a los clientes
    const io = (req as AppRouterRequest).socket?.server?.io; // Castear req a AppRouterRequest
    if (io) {
      io.emit('task_update', taskWithUpdatedAssignees);
      console.log(`Evento 'task_update' emitido para tarea ${updatedTask.id}`);
    }

    return NextResponse.json(taskWithUpdatedAssignees);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * Maneja las solicitudes DELETE para eliminar una tarea por su ID.
 * @param req Objeto de solicitud.
 * @param params Parámetros de la ruta dinámica (contiene el ID de la tarea).
 * @returns Respuesta JSON de éxito o un error.
 */
export async function DELETE(req: AppRouterRequest, { params }: TaskRouteParams) {
  try {
    const { id } = params; // El ID de la tarea es un String (ClickUp ID)

    const existingTask = await prisma.task.findUnique({
      where: { id: id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Eliminar asignaciones de tareas primero para evitar errores de clave foránea
    await prisma.taskAssignment.deleteMany({
      where: { taskId: id },
    });

    // Eliminar la tarea
    await prisma.task.delete({
      where: { id: id },
    });

    // Emitir evento de Socket.IO para notificar a los clientes
    const io = (req as AppRouterRequest).socket?.server?.io; // Castear req a AppRouterRequest
    if (io) {
      io.emit('task_deleted', { id: id });
      console.log(`Evento 'task_deleted' emitido para tarea ${id}`);
    }

    return NextResponse.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
