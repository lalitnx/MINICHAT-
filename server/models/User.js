/**
 * models/User.js — User schema
 *
 * WHAT: Stores registered user accounts.
 *
 * FIELDS:
 * - username:     Display name shown in chat (not unique — people can share names)
 * - email:        Login identifier (unique + indexed for fast lookups)
 * - passwordHash: bcrypt hash of the password — we NEVER store plaintext passwords
 * - avatarUrl:    Profile picture URL (stored as a string, not a file upload)
 *                 Production upgrade: use Cloudinary/S3 for file hosting
 * - inviteCode:   Unique code for user discovery via invite links
 * - createdAt:    Auto-set by Mongoose timestamps
 *
 * SECURITY NOTES:
 * - The `toJSON` transform removes passwordHash from any JSON response,
 *   so even if you accidentally return a user object from an API route,
 *   the password hash is never sent to the client.
 * - Email is stored lowercase to avoid duplicate accounts with different casing.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [2, 'Username must be at least 2 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true, // Always store as lowercase
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    passwordHash: {
      type: String,
      required: true,
      // SECURITY: select: false means this field is NOT returned
      // in normal queries (you have to explicitly .select('+passwordHash'))
      select: false,
    },

    avatarUrl: {
      type: String,
      default: '', // Empty = use a generated avatar on the client
    },

    // Unique invite code for user discovery via shareable links
    inviteCode: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(4).toString('hex'), // 8-char hex string
    },
  },
  {
    // Mongoose auto-creates `createdAt` and `updatedAt` fields
    timestamps: true,

    // Transform every .toJSON() call (which res.json() uses internally)
    // to strip out the passwordHash — defense in depth
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// NOTE: email and inviteCode already have indexes via `unique: true` above.
// No need for explicit schema.index() calls — that would create duplicates.

module.exports = mongoose.model('User', userSchema);

