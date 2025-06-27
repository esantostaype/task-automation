import { Server } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

interface SocketServer extends HTTPServer {
  io?: Server | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export default function SocketHandler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  // Si el servidor de Socket.IO ya está inicializado, no hacer nada
  if (res.socket.server.io) {
    console.log('Socket.IO ya está corriendo');
    res.end();
    return;
  }

  // Inicializar el servidor de Socket.IO
  const io = new Server(res.socket.server, {
    path: '/api/socket_io', // Ruta para la conexión de Socket.IO
    addTrailingSlash: false,
  });

  // Guardar la instancia de io en el servidor para evitar múltiples inicializaciones
  res.socket.server.io = io;

  // Manejar conexiones de clientes
  io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // Escuchar eventos personalizados, por ejemplo, para unirse a una sala
    socket.on('join_task_updates', (taskId: number) => {
      socket.join(`task_${taskId}`);
      console.log(`Cliente ${socket.id} se unió a la sala task_${taskId}`);
    });

    // Escuchar eventos para la creación/actualización de tareas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('task_created', (taskData: any) => {
      console.log('Evento task_created recibido en el servidor:', taskData.id);
      // Emitir el evento a todos los clientes conectados, o a una sala específica
      io.emit('task_update', taskData);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('task_updated', (taskData: any) => {
      console.log('Evento task_updated recibido en el servidor:', taskData.id);
      // Emitir el evento a todos los clientes conectados, o a una sala específica
      io.emit('task_update', taskData);
      // También puedes emitir a una sala específica si el taskId es conocido
      io.to(`task_${taskData.id}`).emit('task_update', taskData);
    });

    // Manejar desconexiones
    socket.on('disconnect', () => {
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  });

  console.log('Socket.IO inicializado');
  res.end();
}