/**
 * controllers/userController.js — User profile & discovery
 *
 * WHAT: Handles user profile operations and user discovery.
 *
 * ENDPOINTS:
 * - GET  /api/users/me       → Get authenticated user's profile
 * - PUT  /api/users/me       → Update username/avatar
 * - GET  /api/users/search   → Search users by email or username
 * - GET  /api/users/invite/:code → Find user by invite code
 */

const { User } = require('../models');

/**
 * GET /api/users/me — Get current user's profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('GetProfile error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * PUT /api/users/me — Update current user's profile
 *
 * Only allows updating username and avatarUrl.
 * Email changes are not allowed (would need re-verification).
 * Password changes would go through a separate flow.
 */
const updateProfile = async (req, res) => {
  try {
    const { username, avatarUrl } = req.body;
    const updates = {};

    // Only include fields that were actually sent
    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return res.status(400).json({
          error: 'Username must be between 2 and 30 characters.',
        });
      }
      updates.username = trimmed;
    }

    if (avatarUrl !== undefined) {
      // Basic URL validation — in production, validate more strictly
      // or use a file upload service like Cloudinary
      updates.avatarUrl = avatarUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updates,
      { new: true, runValidators: true }, // new: true returns the updated doc
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      message: 'Profile updated successfully.',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('UpdateProfile error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * GET /api/users/search?q=searchterm — Search users by email or username
 *
 * Used for user discovery — finding someone to start a conversation with.
 * Returns max 10 results. Does NOT return the searching user themselves.
 *
 * SECURITY: Only returns public info (username, avatar, inviteCode).
 * Does NOT return email in search results to protect privacy.
 */
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters.',
      });
    }

    const searchTerm = q.trim();

    // Search by username (partial match, case-insensitive) OR exact email
    const users = await User.find({
      _id: { $ne: req.user.userId }, // Exclude the searching user
      $or: [
        { username: { $regex: searchTerm, $options: 'i' } }, // partial match
        { email: searchTerm.toLowerCase() }, // exact email match
      ],
    })
      .select('username avatarUrl inviteCode') // Only public fields
      .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('SearchUsers error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * GET /api/users/invite/:code — Find user by invite code
 *
 * Used when someone shares their invite link/code.
 * The recipient opens the link, which resolves the code to a user.
 */
const getUserByInviteCode = async (req, res) => {
  try {
    const { code } = req.params;

    const user = await User.findOne({ inviteCode: code }).select(
      'username avatarUrl inviteCode',
    );

    if (!user) {
      return res.status(404).json({ error: 'Invalid invite code.' });
    }

    res.json({ user });
  } catch (error) {
    console.error('GetByInviteCode error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { getProfile, updateProfile, searchUsers, getUserByInviteCode };
