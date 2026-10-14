/**
 * routes/conversations.js — Conversation routes
 *
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();

const {
  getConversations,
  createConversation,
  getConversation,
} = require('../controllers/conversationController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', getConversations);
router.post('/', createConversation);
router.get('/:id', getConversation);

module.exports = router;
