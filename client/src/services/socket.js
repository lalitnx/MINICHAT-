/**
 * services/socket.js — Socket.io client singleton
 *
 * WHY a singleton: We want exactly one WebSocket connection per browser tab.
 * This module creates and exports a single socket instance that any
 * component can import. The connection is established lazily (autoConnect: false)
 * and started manually after the user logs in.
 *
 * AUTH: The JWT is passed in the `auth` handshake option so the server
 * can verify the user's identity before accepting the connection.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create the socket but don't connect yet (autoConnect: false)
// We'll call socket.connect() after login, once we have a JWT
const socket = io(SOCKET_URL, {
  autoConnect: false,
  // The auth object is sent during the handshake — the server reads
  // socket.handshake.auth.token to verify the JWT
  auth: {
    token: localStorage.getItem('minichat_token') || '',
  },
  // Reconnection settings
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

/**
 * Call this after login to update the token and connect.
 */
export const connectSocket = (token) => {
  socket.auth = { token };
  socket.connect();
};

/**
 * Call this on logout to cleanly disconnect.
 */
export const disconnectSocket = () => {
  socket.disconnect();
};

export default socket;
