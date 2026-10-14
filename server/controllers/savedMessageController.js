/**
 * controllers/savedMessageController.js — Save/Keep message feature
 *
 * WHAT: Lets recipients "keep" a self-destructing message before it expires.
 *
 * HOW IT WORKS:
 * 1. User clicks "Keep" on a message
 * 2. We create a SavedMessage record (content snapshot)
 * 3. We clear the original message's expiresAt (cancels TTL deletion)
 * 4. We notify the sender via socket that their message was saved (transparency)
 *
 * WHY NOTIFY THE SENDER (viva point):
 * In a privacy-focused app, transparency is key. If someone sends a
 * self-destructing message expecting it to disappear, they should know
 * if the recipient decided to keep it. This builds trust.
 */

const { Message, SavedMessage } = require('../models');

/**
 * POST /api/messages/:id/save — Save/keep a message
 */
const saveMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user.userId;

    // Find the original message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found or already expired.' });
    }

    // Only the recipient can save a message (not the sender)
    if (message.senderId.toString() === userId) {
      return res.status(403).json({ error: "You can't save your own message." });
    }

    // Check if already saved
    const existing = await SavedMessage.findOne({
      messageId,
      savedByUserId: userId,
    });

    if (existing) {
      return res.status(409).json({ error: 'Message already saved.' });
    }

    // Create saved message snapshot
    const savedMessage = await SavedMessage.create({
      messageId: message._id,
      savedByUserId: userId,
      content: message.content,
      type: message.type,
      originalSenderId: message.senderId,
    });

    // Cancel the TTL deletion by clearing expiresAt
    // MongoDB's TTL monitor ignores documents where the TTL field is null
    await Message.findByIdAndUpdate(messageId, { expiresAt: null });

    // Notify the sender via Socket.io (if they're online)
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${message.senderId.toString()}`).emit('message_saved', {
        messageId: message._id,
        savedByUserId: userId,
        conversationId: message.conversationId,
      });
    }

    res.status(201).json({
      message: 'Message saved successfully.',
      savedMessage,
    });
  } catch (error) {
    console.error('SaveMessage error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * GET /api/messages/saved — Get all saved messages for the authenticated user
 */
const getSavedMessages = async (req, res) => {
  try {
    const userId = req.user.userId;

    const savedMessages = await SavedMessage.find({ savedByUserId: userId })
      .populate('originalSenderId', 'username avatarUrl')
      .sort({ savedAt: -1 })
      .lean();

    res.json({ savedMessages });
  } catch (error) {
    console.error('GetSavedMessages error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { saveMessage, getSavedMessages };
