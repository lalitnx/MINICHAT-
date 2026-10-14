/**
 * models/index.js — Central export for all Mongoose models
 *
 * WHY: Instead of writing `require('../models/User')` in every controller,
 * you can do `const { User, Message } = require('../models')`.
 * Cleaner imports and one place to see all models.
 */

const User = require('./User');
const Conversation = require('./Conversation');
const Message = require('./Message');
const SavedMessage = require('./SavedMessage');
const ModerationLog = require('./ModerationLog');

module.exports = {
  User,
  Conversation,
  Message,
  SavedMessage,
  ModerationLog,
};
