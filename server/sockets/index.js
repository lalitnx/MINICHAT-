/**
 * sockets/index.js — Socket.io server setup & authentication
 *
 * WHAT THIS FILE DOES:
 * 1. Authenticates WebSocket connections using JWT
 * 2. Tracks which users are online (in-memory Map)
 * 3. Registers event handlers for messaging, typing, and presence
 * 4. Handles disconnection cleanup
 *
 * HOW SOCKET.IO AUTH WORKS (viva explainer):
 * When the client calls socket.connect(), Socket.io does a "handshake".
 * During this handshake, the client sends the JWT in socket.handshake.auth.token.
 * Our middleware intercepts this, verifies the JWT, and either allows or
 * rejects the connection. This ensures only logged-in users can establish
 * a WebSocket connection.
 *
 * ROOM STRATEGY:
 * - Each user joins a personal room named `user:<userId>` — used for
 *   direct messages, notifications, and presence events
 * - Each conversation has a room named `conversation:<conversationId>` —
 *   users join when they open a chat, used for message broadcasting
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const registerMessageHandlers = require('./handlers/messageHandler');
const registerTypingHandlers = require('./handlers/typingHandler');
const registerPresenceHandlers = require('./handlers/presenceHandler');
const registerCallHandlers = require('./handlers/callHandler');

// In-memory map of online users: userId → Set of socketIds
// (one user can have multiple tabs/devices open)
const onlineUsers = new Map();

const initializeSockets = (io) => {
  // ─── Authentication middleware ────────────────────────────────────
  // Runs once per connection attempt, BEFORE any events are processed
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT — same logic as the HTTP auth middleware
      const decoded = jwt.verify(token, config.jwtSecret);

      // Fetch user from DB to make sure they still exist
      const user = await User.findById(decoded.userId).select(
        'username avatarUrl',
      );

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user info to the socket for use in event handlers
      socket.userId = decoded.userId;
      socket.username = user.username;

      next(); // Allow the connection
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ───────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`🔌 User connected: ${socket.username} (${userId})`);

    // Join the user's personal room
    socket.join(`user:${userId}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast that this user is now online
    socket.broadcast.emit('user_online', { userId });

    // Send the user the current list of online users
    socket.emit('online_users', {
      userIds: Array.from(onlineUsers.keys()),
    });

    // ─── Register event handlers ──────────────────────────────────
    registerMessageHandlers(io, socket, onlineUsers);
    registerTypingHandlers(io, socket);
    registerPresenceHandlers(io, socket, onlineUsers);
    registerCallHandlers(io, socket);

    // ─── Disconnection ────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.username} (${userId})`);

      // Remove this socket from the user's set
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more sockets for this user, they're fully offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast that user went offline
          socket.broadcast.emit('user_offline', { userId });
        }
      }
    });
  });
};

module.exports = initializeSockets;
