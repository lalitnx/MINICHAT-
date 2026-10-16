/**
 * controllers/conversationController.js — Conversation management
 *
 * WHAT: Handles creating and fetching conversations (1-on-1 chats).
 *
 * ENDPOINTS:
 * - GET  /api/conversations           → List all conversations for the user
 * - POST /api/conversations           → Create or get existing conversation
 * - GET  /api/conversations/:id       → Get a single conversation with messages
 *
 * DESIGN DECISION: When creating a 1-on-1 conversation, we first check if
 * one already exists between the two users. If yes, return the existing one
 * instead of creating a duplicate. This prevents multiple conversation
 * threads between the same two people.
 */

const { Conversation, Message, User } = require('../models');
const { getOrCreateNovaConversation } = require('../services/novaService');
const mongoose = require('mongoose');

/**
 * GET /api/conversations — List all conversations for the authenticated user
 *
 * Returns conversations sorted by most recent message (like WhatsApp).
 * Each conversation includes the other participant's info (populated).
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participantIds: userId,
    })
      .populate('participantIds', 'username avatarUrl inviteCode isBot') // Populate user info
      .sort({ lastMessageAt: -1 }) // Newest first
      .lean(); // Return plain objects (faster, no Mongoose overhead)

    // For each conversation, get the last message preview
    const conversationsWithPreview = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({
          conversationId: conv._id,
        })
          .sort({ createdAt: -1 })
          .select('content type senderId createdAt status')
          .lean();

        // Count unread messages (sent to this user, not yet seen)
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          senderId: { $ne: userId },
          status: { $ne: 'seen' },
        });

        return {
          ...conv,
          lastMessage: lastMessage || null,
          unreadCount,
        };
      }),
    );

    res.json({ conversations: conversationsWithPreview });
  } catch (error) {
    console.error('GetConversations error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * POST /api/conversations — Create a new conversation or return existing
 *
 * Body: { participantId: "userId_of_other_person" }
 *
 * If a 1-on-1 conversation already exists between these two users,
 * return it instead of creating a new one.
 */
const createConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.user.userId;

    // Validate participantId
    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required.' });
    }

    if (participantId === userId) {
      return res.status(400).json({ error: "You can't chat with yourself." });
    }

    // Check if the other user exists
    const otherUser = await User.findById(participantId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if a 1-on-1 conversation already exists between these two users
    // $all ensures BOTH users are in participantIds, $size ensures exactly 2
    const existingConversation = await Conversation.findOne({
      participantIds: {
        $all: [userId, participantId],
        $size: 2,
      },
      isGroup: false,
    }).populate('participantIds', 'username avatarUrl inviteCode isBot');

    if (existingConversation) {
      return res.json({
        conversation: existingConversation,
        isNew: false,
      });
    }

    // Create new conversation
    const conversation = await Conversation.create({
      participantIds: [userId, participantId],
      isGroup: false,
    });

    // Populate participant info before returning
    const populated = await Conversation.findById(conversation._id).populate(
      'participantIds',
      'username avatarUrl inviteCode isBot',
    );

    res.status(201).json({
      conversation: populated,
      isNew: true,
    });
  } catch (error) {
    console.error('CreateConversation error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * GET /api/conversations/:id — Get a single conversation with recent messages
 *
 * Returns the conversation info + last 50 messages (paginated).
 * Query param: ?before=messageId for pagination (load older messages).
 */
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID.' });
    }

    // Find conversation and verify the user is a participant
    const conversation = await Conversation.findOne({
      _id: id,
      participantIds: userId, // Security: user must be a participant
    }).populate('participantIds', 'username avatarUrl inviteCode isBot');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Build message query with optional pagination
    const messageQuery = { conversationId: id };
    const { before } = req.query;

    if (before && mongoose.Types.ObjectId.isValid(before)) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        messageQuery.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    // Get last 50 messages, newest first, then reverse for display order
    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('senderId', 'username avatarUrl isBot')
      .lean();

    messages.reverse(); // Oldest first for chat display

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error('GetConversation error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * POST /api/conversations/nova — Get or create conversation with Nova AI bot
 */
const getNovaConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversation = await getOrCreateNovaConversation(userId);
    res.json({ conversation });
  } catch (error) {
    console.error('GetNovaConversation error:', error.message);
    res.status(500).json({ error: 'Failed to access Nova AI conversation.' });
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversation,
  getNovaConversation,
};
