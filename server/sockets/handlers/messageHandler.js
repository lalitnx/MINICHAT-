/**
 * sockets/handlers/messageHandler.js — Real-time message events
 *
 * EVENTS HANDLED:
 * - join_conversation  → User opens a chat, joins the room
 * - leave_conversation → User navigates away from the chat
 * - send_message       → User sends a message
 * - message_seen       → Recipient has read the message → STARTS the self-destruct timer
 *
 * ════════════════════════════════════════════════════════════════════
 * SELF-DESTRUCT FLOW (viva explainer):
 *
 *  Sender types → send_message event
 *       ↓
 *  Server runs Gemini moderation (Step 8 — added later)
 *       ↓
 *  Message saved to DB with expiresAt = null (won't auto-delete yet)
 *       ↓
 *  Server emits receive_message to recipient
 *       ↓
 *  Recipient opens chat → message_seen event
 *       ↓
 *  Server computes: expiresAt = now + 10s base + random(5-15s) jitter
 *       ↓
 *  Server updates Message.expiresAt in DB
 *       ↓
 *  MongoDB TTL monitor deletes the doc when expiresAt passes (~60s check interval)
 *       ↓
 *  Client shows disappear animation based on expiresAt timestamp
 * ════════════════════════════════════════════════════════════════════
 */

const { Message, Conversation } = require('../../models');
const config = require('../../config');
const { moderateContent } = require('../../services/moderationService');

const registerMessageHandlers = (io, socket, onlineUsers) => {
  const userId = socket.userId;

  /**
   * join_conversation — User opens a chat window
   * Joins the socket room so they receive messages for this conversation
   */
  socket.on('join_conversation', ({ conversationId }) => {
    socket.join(`conversation:${conversationId}`);
    console.log(`💬 ${socket.username} joined conversation ${conversationId}`);
  });

  /**
   * leave_conversation — User navigates away from the chat
   */
  socket.on('leave_conversation', ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
  });

  /**
   * send_message — User sends a new message
   *
   * Expected payload: { conversationId, content, type: 'text'|'voice', voiceUrl? }
   */
  socket.on('send_message', async (data, callback) => {
    try {
      const { conversationId, content, type = 'text', voiceUrl = '' } = data;

      // Validate
      if (!conversationId) {
        return callback?.({ error: 'conversationId is required.' });
      }

      if (type === 'text' && (!content || !content.trim())) {
        return callback?.({ error: 'Message content is required.' });
      }

      if (type === 'voice' && !voiceUrl) {
        return callback?.({ error: 'Voice URL is required for voice messages.' });
      }

      // Verify user is a participant in this conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participantIds: userId,
      });

      if (!conversation) {
        return callback?.({ error: 'Conversation not found.' });
      }

      // ── Content moderation via Gemini API ──
      // Check message content before saving. If flagged, reject it.
      if (type === 'text' && content) {
        const moderationResult = await moderateContent(content, userId);
        if (moderationResult.flagged) {
          return callback?.({
            error: `Message blocked: ${moderationResult.reason}. Please keep the conversation respectful.`,
          });
        }
      }

      // Save message to DB — expiresAt is null (no auto-delete until "seen")
      const message = await Message.create({
        conversationId,
        senderId: userId,
        type,
        content:
          type === 'text'
            ? content.trim()
            : content || (type === 'voice' ? '🎤 Voice message' : '💳 Payment'),
        voiceUrl: type === 'voice' ? voiceUrl : '',
        status: 'sent',
        expiresAt: null, // IMPORTANT: starts as null — no TTL yet
      });

      // Update conversation's lastMessageAt for sorting
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageAt: new Date(),
      });

      // Populate sender info for the client
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'username avatarUrl')
        .lean();

      // Emit to all users in the conversation room (including sender for confirmation)
      io.to(`conversation:${conversationId}`).emit(
        'receive_message',
        populatedMessage,
      );

      // Also notify the other participant(s) if they're not in the conversation room
      // (they might be on the conversation list page, not the chat window)
      conversation.participantIds.forEach((participantId) => {
        const pid = participantId.toString();
        if (pid !== userId) {
          io.to(`user:${pid}`).emit('new_message_notification', {
            conversationId,
            message: populatedMessage,
          });
        }
      });

      // Update status to 'delivered' if recipient is online
      conversation.participantIds.forEach((participantId) => {
        const pid = participantId.toString();
        if (pid !== userId && onlineUsers.has(pid)) {
          Message.findByIdAndUpdate(message._id, {
            status: 'delivered',
          }).exec();
          io.to(`conversation:${conversationId}`).emit('message_status_update', {
            messageId: message._id,
            status: 'delivered',
          });
        }
      });

      // Acknowledge to sender
      callback?.({ success: true, message: populatedMessage });
    } catch (error) {
      console.error('send_message error:', error.message);
      callback?.({ error: 'Failed to send message.' });
    }
  });

  /**
   * message_seen — Recipient has read the message
   *
   * THIS IS WHERE THE SELF-DESTRUCT TIMER STARTS.
   *
   * We compute a random expiresAt so the user can't predict exactly when
   * the message will disappear.
   */
  socket.on('message_seen', async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) return;

      // Only the recipient (not the sender) triggers "seen"
      if (message.senderId.toString() === userId) return;

      // Don't re-process already-seen messages
      if (message.status === 'seen') return;

      const now = new Date();

      // ── Compute self-destruct time with random jitter ──
      // base: 10 seconds + random: 5–15 seconds = total 15–25 seconds
      const { baseDelayMs, jitterMinMs, jitterMaxMs } = config.messageExpiry;
      const jitter =
        Math.floor(Math.random() * (jitterMaxMs - jitterMinMs + 1)) + jitterMinMs;
      const expiresAt = new Date(now.getTime() + baseDelayMs + jitter);

      // Update the message
      await Message.findByIdAndUpdate(messageId, {
        status: 'seen',
        seenAt: now,
        expiresAt, // THIS triggers the TTL deletion countdown
      });

      // Notify the conversation room of the status change + expiry time
      io.to(`conversation:${conversationId}`).emit('message_status_update', {
        messageId,
        status: 'seen',
        seenAt: now,
        expiresAt, // Client uses this to show countdown/animation
      });

      // Notify the sender specifically
      io.to(`user:${message.senderId.toString()}`).emit('message_status_update', {
        messageId,
        status: 'seen',
        seenAt: now,
        expiresAt,
      });
    } catch (error) {
      console.error('message_seen error:', error.message);
    }
  });

  /**
   * mark_messages_seen — Bulk mark all messages in a conversation as seen
   * Called when user opens a conversation
   */
  socket.on('mark_messages_seen', async ({ conversationId }) => {
    try {
      // Find all unseen messages sent by OTHER users in this conversation
      const unseenMessages = await Message.find({
        conversationId,
        senderId: { $ne: userId },
        status: { $ne: 'seen' },
      });

      const now = new Date();
      const { baseDelayMs, jitterMinMs, jitterMaxMs } = config.messageExpiry;

      for (const message of unseenMessages) {
        const jitter =
          Math.floor(Math.random() * (jitterMaxMs - jitterMinMs + 1)) + jitterMinMs;
        const expiresAt = new Date(now.getTime() + baseDelayMs + jitter);

        await Message.findByIdAndUpdate(message._id, {
          status: 'seen',
          seenAt: now,
          expiresAt,
        });

        io.to(`conversation:${conversationId}`).emit('message_status_update', {
          messageId: message._id,
          status: 'seen',
          seenAt: now,
          expiresAt,
        });
      }
    } catch (error) {
      console.error('mark_messages_seen error:', error.message);
    }
  });
};

module.exports = registerMessageHandlers;
