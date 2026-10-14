/**
 * controllers/authController.js — Register & Login logic
 *
 * WHAT: Handles user registration and login.
 *
 * REGISTER FLOW:
 * 1. Check if email already exists in DB
 * 2. Hash the password with bcrypt (cost factor 12)
 * 3. Create the user document in MongoDB
 * 4. Generate a JWT token
 * 5. Return the token + user info (without password hash)
 *
 * LOGIN FLOW:
 * 1. Find user by email (must explicitly select passwordHash since it's
 *    excluded by default in the schema)
 * 2. Compare the provided password with the stored hash using bcrypt
 * 3. If match → generate JWT and return it
 * 4. If no match → return generic "Invalid credentials" error
 *
 * SECURITY: On login failure, we NEVER reveal whether the email exists
 * or the password was wrong. We always say "Invalid credentials" — this
 * prevents user enumeration attacks (where an attacker probes emails to
 * find which ones are registered).
 *
 * BCRYPT EXPLAINED (viva):
 * bcrypt is a one-way hashing algorithm designed for passwords. "One-way"
 * means you can't reverse the hash to get the original password. The "cost
 * factor" (12 here) controls how slow the hashing is — higher = more secure
 * but slower. Each increase doubles the time. Cost 12 takes ~250ms on modern
 * hardware, which is fast enough for login but painfully slow for brute-force.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config');

/**
 * Generate a JWT token for a user
 * The token contains ONLY the userId — we look up full user data
 * from the DB when needed (don't store sensitive data in tokens)
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }, // '7d' from config
  );
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    // 2. Hash the password
    // NEVER store plaintext passwords — this is the #1 security rule
    // Salt rounds (12) = how many times bcrypt re-hashes internally
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create the user
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    });

    // 4. Generate JWT
    const token = generateToken(user._id);

    // 5. Return token + user (passwordHash is auto-stripped by toJSON transform)
    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Register error:', error.message);

    // Handle duplicate key error (race condition — two requests at same time)
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    // We must explicitly .select('+passwordHash') because the schema
    // has `select: false` on that field (it's excluded from normal queries)
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select('+passwordHash');

    // SECURITY: Generic error message — don't reveal if email exists
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials. Please check your email and password.',
      });
    }

    // 2. Compare password with stored hash
    // bcrypt.compare() hashes the provided password with the same salt
    // that was used originally, then compares the results
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Same generic message — attacker can't tell if email or password was wrong
      return res.status(401).json({
        error: 'Invalid credentials. Please check your email and password.',
      });
    }

    // 3. Generate JWT
    const token = generateToken(user._id);

    // 4. Return token + user
    res.json({
      message: 'Login successful!',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

/**
 * GET /api/auth/me — Get current user from token
 * Used by the client to verify a saved token is still valid on page refresh
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('GetMe error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { register, login, getMe };
