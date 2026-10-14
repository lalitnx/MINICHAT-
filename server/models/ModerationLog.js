/**
 * models/ModerationLog.js — Content moderation audit log
 *
 * WHAT: Records every content moderation check performed by the Gemini API.
 *       This serves as an audit trail — if a message is flagged, you can see
 *       why, and if moderation times out, you can review those messages later.
 *
 * WHY log EVERY check (not just flagged ones):
 * For a college project, having a complete log shows you thought about
 * accountability and auditing. In production, you'd likely only log flagged
 * messages to save storage, but for a viva, the full log is more impressive.
 *
 * FIELDS:
 * - messageId:    Reference to the message that was checked
 * - senderId:     Who sent the message (denormalized for quick queries)
 * - content:      Snapshot of the message content at check time
 * - flagged:      true if Gemini deemed it inappropriate
 * - reason:       Why it was flagged (e.g., "harassment", "explicit")
 *                 or "clean" if it passed, or "timeout_fallback" if Gemini was slow
 * - checkedAt:    When the moderation check happened
 */

const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null, // null if the message was rejected before saving
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    flagged: {
      type: Boolean,
      required: true,
    },

    reason: {
      type: String,
      default: 'clean',
    },

    checkedAt: {
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

// Index: find all flagged messages quickly (for admin review)
moderationLogSchema.index({ flagged: 1, checkedAt: -1 });

// Index: find all moderation actions for a specific sender
moderationLogSchema.index({ senderId: 1 });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
