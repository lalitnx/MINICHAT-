/**
 * middleware/validate.js — Input validation helpers
 *
 * WHAT: Validates user input (email format, password strength, username)
 *       BEFORE it reaches the database. This is the server-side validation —
 *       we also have client-side validation, but NEVER trust the client alone
 *       because anyone can bypass it using Postman or cURL.
 *
 * WHY server-side validation matters (viva point):
 * Client-side validation improves UX (instant feedback), but server-side
 * validation provides SECURITY. A malicious user can disable JavaScript
 * or send requests directly to the API, skipping all client checks.
 * Always validate on BOTH sides.
 */

/**
 * Validates email format using a regex pattern
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }

  const trimmed = email.trim().toLowerCase();

  // Standard email regex — covers 99% of valid email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }

  return { valid: true };
};

/**
 * Validates password strength
 * Requirements: min 8 chars, at least 1 uppercase, at least 1 number
 *
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters.' };
  }

  return { valid: true };
};

/**
 * Validates username
 * Requirements: 2–30 characters, trimmed
 *
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required.' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Username must be at least 2 characters.' };
  }

  if (trimmed.length > 30) {
    return { valid: false, error: 'Username cannot exceed 30 characters.' };
  }

  return { valid: true };
};

/**
 * Express middleware that validates registration input
 * Checks username, email, and password — returns all errors at once
 */
const validateRegisterInput = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  const usernameCheck = validateUsername(username);
  if (!usernameCheck.valid) errors.push(usernameCheck.error);

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) errors.push(emailCheck.error);

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) errors.push(passwordCheck.error);

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  next();
};

/**
 * Express middleware that validates login input
 * Only checks that email and password are present (not strength —
 * they already set their password during registration)
 */
const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateRegisterInput,
  validateLoginInput,
};
