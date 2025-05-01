import { io } from 'socket.io-client';
console.log("init")
export const socket = io("http://localhost:3001");