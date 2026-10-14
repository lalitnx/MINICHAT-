/**
 * models/SavedMessage.js — Saved/Kept message schema
 *
 * WHAT: When a recipient "keeps" a self-destructing message, we create
 *       a SavedMessage record. This does two things:
 *       1. Preserves the message content (so it's not lost when TTL fires)
 *       2. The sender gets notified that their message was saved (transparency)
 *
 * HOW SAVE WORKS:
 * When a user clicks "Keep" on a message:
 * 1. A SavedMessage document is created with the message content snapshot
 * 2. The original Message's `expiresAt` is set to null (cancels TTL deletion)
 * 3. A `message_saved` socket event notifies the sender
 *
 * WHY snapshot the content instead of just referencing messageId:
 * If we only stored a reference and something went wrong (race condition
 * with TTL deletion, or the user later un-saves), we'd lose the content.
 * Storing a snapshot ensures the saved message is always readable.
 */

const mongoose = require('mongoose');

const savedMessageSchema = new mongoose.Schema(
  {
    // Reference to the original message (may be deleted by TTL eventually
    // if save was too late, but we have the content snapshot below)
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },

    // Who saved/kept the message
    savedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Snapshot of the message content at save time
    content: {
      type: String,
      default: '',
    },

    // Snapshot of the message type (text/voice)
    type: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },

    // Who originally sent the message
    originalSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // When the message was saved
    savedAt: {
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

// Index: quickly find all messages saved by a specific user
savedMessageSchema.index({ savedByUserId: 1, savedAt: -1 });

// Prevent saving the same message twice
savedMessageSchema.index({ messageId: 1, savedByUserId: 1 }, { unique: true });

module.exports = mongoose.model('SavedMessage', savedMessageSchema);
