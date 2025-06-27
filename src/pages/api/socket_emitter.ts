// pages/api/socket-emitter.ts
import { Server as SocketIOServer } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';

// Define la interfaz para el servidor de Socket.IO en el objeto de respuesta
interface SocketServer extends HTTPServer {
  io?: SocketIOServer | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (req.method === 'POST') {
    const { eventName, data } = req.body;

    const io = res.socket.server.io;

    if (io) {
      io.emit(eventName, data);
      console.log(`Evento Socket.IO '${eventName}' emitido con datos:`, data.id);
      res.status(200).json({ success: true, message: 'Evento emitido' });
    } else {
      console.warn('Socket.IO server no está disponible para emitir.');
      res.status(500).json({ success: false, message: 'Socket.IO server no disponible' });
    }
  } else {
    res.status(405).json({ message: 'Método no permitido' });
  }
}
