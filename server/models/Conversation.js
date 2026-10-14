/**
 * models/Conversation.js — Conversation schema
 *
 * WHAT: Represents a chat conversation between two users.
 *       (Group chat is defined in the schema but not built yet — 1-on-1 only for MVP.)
 *
 * FIELDS:
 * - participantIds: Array of User ObjectIds in this conversation.
 *                   For 1-on-1, this always has exactly 2 elements.
 * - isGroup:        false for 1-on-1, true for group (future feature)
 * - groupName:      Name of the group (only used when isGroup is true)
 * - lastMessageAt:  Timestamp of the most recent message — used to sort
 *                   the conversation list (newest on top), like WhatsApp.
 * - createdAt:      Auto-set by Mongoose timestamps
 *
 * WHY participantIds (not just senderId + receiverId):
 * Using an array is more flexible — it already supports group chats
 * when we add them later, and querying "find all conversations for user X"
 * is just: Conversation.find({ participantIds: userId })
 */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Foreign key → User collection
        required: true,
      },
    ],

    isGroup: {
      type: Boolean,
      default: false,
    },

    groupName: {
      type: String,
      default: '',
      trim: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound index: quickly find all conversations a user is in,
// sorted by most recent message first
conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
