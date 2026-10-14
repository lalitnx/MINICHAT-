/**
 * sockets/handlers/typingHandler.js — Typing indicator events
 *
 * WHAT: Shows "User is typing..." in real-time.
 *
 * EVENTS:
 * - typing      → User starts typing → broadcast to conversation
 * - stop_typing → User stops typing → broadcast to conversation
 *
 * WHY broadcast to the room (not direct to user):
 * In a 1-on-1 chat, broadcasting to the room and sending directly
 * would be the same. But using rooms is consistent and will work
 * for group chat when we add it later.
 */

const registerTypingHandlers = (io, socket) => {
  const userId = socket.userId;
  const username = socket.username;

  const handleTyping = ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      username,
      conversationId,
    });
  };

  const handleStopTyping = ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user_stop_typing', {
      userId,
      conversationId,
    });
  };

  socket.on('typing', handleTyping);
  socket.on('typing_start', handleTyping);

  socket.on('stop_typing', handleStopTyping);
  socket.on('typing_stop', handleStopTyping);
};

module.exports = registerTypingHandlers;
