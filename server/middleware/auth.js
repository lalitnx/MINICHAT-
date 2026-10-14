/**
 * middleware/auth.js — JWT authentication middleware
 *
 * WHAT THIS DOES:
 * This middleware runs BEFORE any protected route handler. It checks if
 * the incoming request has a valid JWT token. If yes, it decodes the token
 * and attaches the user's ID to `req.user` so route handlers know WHO
 * is making the request. If no valid token, it returns 401 Unauthorized.
 *
 * HOW JWT WORKS (viva explainer):
 * 1. User logs in → server creates a JWT containing { userId } + signs it
 *    with a secret key (JWT_SECRET in .env)
 * 2. Client stores the JWT and sends it with every request in the
 *    Authorization header: "Bearer eyJhbGciOi..."
 * 3. This middleware extracts the token, verifies the signature using the
 *    same secret key, and decodes the userId from it
 * 4. If the signature is valid → the token hasn't been tampered with
 *    If the token is expired → reject the request
 *
 * SECURITY NOTE: The JWT secret MUST be kept private. Anyone who knows
 * the secret can forge tokens and impersonate any user.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

const authMiddleware = (req, res, next) => {
  try {
    // 1. Extract token from "Authorization: Bearer <token>" header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
      });
    }

    // "Bearer eyJhbGciOi..." → "eyJhbGciOi..."
    const token = authHeader.split(' ')[1];

    // 2. Verify and decode the token
    // jwt.verify() does two things:
    //   a) Checks the signature (was this token created with our secret?)
    //   b) Checks expiration (is the token still valid?)
    // If either check fails, it throws an error
    const decoded = jwt.verify(token, config.jwtSecret);

    // 3. Attach the decoded user info to the request object
    // Now any route handler after this middleware can access req.user.userId
    req.user = {
      userId: decoded.userId,
    };

    // 4. Pass control to the next middleware or route handler
    next();
  } catch (error) {
    // Token is invalid or expired
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Invalid token. Access denied.',
    });
  }
};

module.exports = authMiddleware;
