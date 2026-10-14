/**
 * routes/messages.js — Message routes (save/keep feature)
 *
 * Note: Most message operations happen through Socket.io (real-time).
 * These REST endpoints are for the save/keep feature only.
 */

const express = require('express');
const router = express.Router();

const { saveMessage, getSavedMessages } = require('../controllers/savedMessageController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Save/keep a message before it expires
router.post('/:id/save', saveMessage);

// Get all saved messages for the authenticated user
router.get('/saved', getSavedMessages);

module.exports = router;
