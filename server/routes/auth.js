/**
 * routes/auth.js — Authentication routes
 *
 * WHAT: Maps URL paths to controller functions, with middleware in between.
 *
 * Route pipeline for POST /api/auth/register:
 *   Request → registerLimiter → validateRegisterInput → authController.register → Response
 *
 * Each middleware either:
 *   - Calls next() → passes control to the next function in the chain
 *   - Sends a response → stops the chain (e.g., validation fails → return 400)
 */

const express = require('express');
const router = express.Router();

const { register, login, getMe } = require('../controllers/authController');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { validateRegisterInput, validateLoginInput } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/register
// Pipeline: rate limit → validate input → create account
router.post('/register', registerLimiter, validateRegisterInput, register);

// POST /api/auth/login
// Pipeline: rate limit → validate input → check credentials
router.post('/login', loginLimiter, validateLoginInput, login);

// GET /api/auth/me
// Pipeline: verify JWT → return current user
// This is used by the client on page refresh to verify the saved token
router.get('/me', authMiddleware, getMe);

module.exports = router;
