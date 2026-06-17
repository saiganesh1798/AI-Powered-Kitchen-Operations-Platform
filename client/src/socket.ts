import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  reconnectionDelayMax: 10000, // Exponential backoff max
  // Start with polling then upgrade to websocket for broad hosting compatibility
  transports: ['polling', 'websocket'],
});
