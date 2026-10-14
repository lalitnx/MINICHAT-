/**
 * sockets/handlers/presenceHandler.js — Online/offline presence
 *
 * WHAT: Lets users see who is online in real-time.
 *
 * EVENTS:
 * - get_online_status → Client asks if a specific user is online
 *
 * NOTE: The main online/offline broadcasts happen in sockets/index.js
 * during connection and disconnection. This handler provides
 * on-demand status checks for specific users.
 */

const registerPresenceHandlers = (io, socket, onlineUsers) => {
  /**
   * get_online_status — Check if a specific user is online
   * Used when opening a conversation to show the status dot
   */
  socket.on('get_online_status', ({ userId }, callback) => {
    const isOnline = onlineUsers.has(userId);
    callback?.({ userId, isOnline });
  });

  /**
   * get_online_users — Get all currently online users
   * Used when the client reconnects and needs to refresh status
   */
  socket.on('get_online_users', (callback) => {
    callback?.({ userIds: Array.from(onlineUsers.keys()) });
  });
};

module.exports = registerPresenceHandlers;
