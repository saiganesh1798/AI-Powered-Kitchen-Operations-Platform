import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { registerSocketHandlers } from './handlers';

let ioInstance: Server | null = null;

export function initializeSocket(httpServer: HttpServer, corsOrigins: string[]): Server {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  ioInstance.on('connection', (socket: Socket) => {
    registerSocketHandlers(ioInstance!, socket);
  });

  return ioInstance;
}

export function getIO(): Server | null {
  return ioInstance;
}
