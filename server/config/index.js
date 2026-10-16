/**
 * config/index.js — Centralised configuration
 *
 * WHY: Instead of scattering `process.env.XYZ` calls across the codebase,
 * we read everything here once and export a single config object.
 * This makes it easy to see what env vars the app needs, provide defaults
 * for development, and catch missing values early.
 */

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: true,
});

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/minichat',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
  jwtExpiresIn: '7d', // tokens last 7 days — reasonable for a chat app

  // CORS — which frontend origin is allowed to call the API
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Google Gemini API (ignore dummy template placeholder values)
  geminiApiKey:
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'YOUR_REAL_API_KEY' &&
    process.env.GEMINI_API_KEY !== 'your-gemini-api-key'
      ? process.env.GEMINI_API_KEY
      : '',

  // Razorpay API (In-app payments / WhatsApp Pay style)
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',

  // Message self-destruct timing (in milliseconds)
  // DESIGN DECISION: base delay + random jitter makes exact deletion time
  // unpredictable to the user, enhancing the "self-destruct" feel.
  messageExpiry: {
    baseDelayMs: 10_000,    // 10 seconds after "seen"
    jitterMinMs: 5_000,     // minimum random addition
    jitterMaxMs: 15_000,    // maximum random addition
    // So total time after "seen" is 15–25 seconds
  },
};

module.exports = config;
