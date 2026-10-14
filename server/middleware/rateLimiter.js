/**
 * middleware/rateLimiter.js — Rate limiting for auth routes
 *
 * WHAT: Limits how many login/register requests a single IP address can
 *       make in a time window. This prevents brute-force attacks where
 *       an attacker tries thousands of password combinations.
 *
 * HOW: express-rate-limit tracks request counts per IP in memory.
 *       When the limit is exceeded, it returns 429 Too Many Requests.
 *
 * DESIGN DECISION: We use in-memory storage (default). This means
 * rate limits reset if the server restarts. For production, you'd use
 * a Redis-based store so limits persist across restarts and scale
 * across multiple server instances. For a college project, in-memory is fine.
 */

const rateLimit = require('express-rate-limit');

// Limiter for login — 100 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // generous for development
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in headers (RateLimit-*)
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

// Limiter for registration — 100 accounts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // generous for development
  message: {
    error: 'Too many accounts created. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter — 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
