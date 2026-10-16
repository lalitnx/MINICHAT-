/**
 * models/Message.js — Message schema (with TTL auto-deletion)
 *
 * WHAT: Stores individual chat messages. This is the core of MiniChat's
 *       self-destruct feature — messages automatically delete themselves
 *       from MongoDB after being read.
 *
 * ════════════════════════════════════════════════════════════════════
 *  HOW THE TTL (Time-To-Live) INDEX WORKS — VIVA EXPLAINER
 * ════════════════════════════════════════════════════════════════════
 *
 * MongoDB has a built-in feature called "TTL indexes". When you create
 * an index with `expireAfterSeconds` on a Date field, MongoDB runs a
 * background task (the "TTL monitor") that checks every ~60 seconds
 * for documents where that Date field is in the past.
 *
 * We use `expireAfterSeconds: 0` on the `expiresAt` field. This means:
 * "Delete this document as soon as `expiresAt` is in the past."
 *
 * The clever part: we DON'T set `expiresAt` when the message is created.
 * Instead, `expiresAt` starts as `null` (message lives forever). Only
 * when the recipient marks the message as "seen" do we compute:
 *
 *   expiresAt = seenAt + 10 seconds + random(5–15 seconds)
 *
 * This random jitter (total 15–25 seconds) means the user can't predict
 * the exact moment a message will vanish — creating the "self-destruct" feel.
 *
 * REAL LIMITATION (mention in viva): MongoDB's TTL monitor thread runs
 * approximately every 60 seconds. So even if `expiresAt` passes, the
 * actual deletion may take up to 60 seconds longer. We handle this on
 * the client by triggering the disappear animation from the computed
 * `expiresAt`, even though the DB document may still exist briefly.
 * ════════════════════════════════════════════════════════════════════
 *
 * FIELDS:
 * - conversationId: Which conversation this message belongs to
 * - senderId:       Who sent it
 * - type:           "text" or "voice"
 * - content:        The text content (for text messages)
 * - voiceUrl:       URL to the voice recording (for voice messages)
 * - status:         "sent" → "delivered" → "seen" (delivery tracking)
 * - seenAt:         When the recipient first opened/read the message
 * - expiresAt:      When MongoDB should auto-delete this message (null = no expiry)
 * - createdAt:      Auto-set by Mongoose timestamps
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    type: {
      type: String,
      enum: ['text', 'voice', 'payment'],
      default: 'text',
    },

    content: {
      type: String,
      default: '',
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },

    voiceUrl: {
      type: String,
      default: '',
    },

    paymentDetails: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending',
      },
    },

    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent',
    },

    seenAt: {
      type: Date,
      default: null,
    },

    // THE KEY FIELD: starts as null (no expiry).
    // Set dynamically when message is "seen" → triggers TTL deletion.
    expiresAt: {
      type: Date,
      default: null,
    },

    // AI Chatbot fields (for Nova AI responses)
    isAi: {
      type: Boolean,
      default: false,
    },

    // Web search grounding citations from Google Search
    groundingSources: [
      {
        title: { type: String, default: '' },
        url: { type: String, default: '' },
      },
    ],
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

// ─── TTL INDEX ──────────────────────────────────────────────────────
// expireAfterSeconds: 0 means "delete when expiresAt is in the past"
// Documents where expiresAt is null are IGNORED by the TTL monitor
// (they won't be auto-deleted — exactly what we want for unseen messages)
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Query indexes ──────────────────────────────────────────────────
// Fast lookup: "get all messages in conversation X, newest first"
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Fast lookup: "get all messages sent by user X" (for user profile / analytics)
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
