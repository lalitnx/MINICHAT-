/**
 * routes/users.js — User profile & discovery routes
 *
 * All routes here require authentication (authMiddleware).
 *
 * ENDPOINTS:
 * - GET  /api/users/me           → Get own profile
 * - PUT  /api/users/me           → Update own profile
 * - GET  /api/users/search?q=... → Search for users
 * - GET  /api/users/invite/:code → Look up user by invite code
 */

const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  searchUsers,
  getUserByInviteCode,
} = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

// All user routes require authentication
router.use(authMiddleware);

// Profile
router.get('/me', getProfile);
router.put('/me', updateProfile);

// Discovery
router.get('/search', searchUsers);
router.get('/invite/:code', getUserByInviteCode);

module.exports = router;
