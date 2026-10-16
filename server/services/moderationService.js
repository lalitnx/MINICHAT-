/**
 * services/moderationService.js — Content moderation using Google Gemini API
 *
 * WHAT: Before any message is saved and broadcast, we ask the Gemini API
 *       to classify it as safe or unsafe (harassment, hate speech, explicit, etc.).
 *
 * HOW:
 * 1. Send a short classification prompt to Gemini with the message content
 * 2. Parse the response for a flagged/clean decision
 * 3. Return the result so the message handler can allow or reject
 *
 * PERFORMANCE (viva point):
 * To keep chat feeling fast, we set a 3-second timeout. If Gemini doesn't
 * respond in 3 seconds, we ALLOW the message through and log it for
 * async review later. This "fail open" approach prioritises chat speed
 * over blocking potentially slow API calls.
 *
 * TRADE-OFF (viva point):
 * "Fail open" means a harmful message COULD slip through during an API
 * timeout. The alternative "fail closed" (block message if moderation
 * times out) would be safer but could break chat if the API is slow.
 * For a college project, fail-open with logging is the pragmatic choice.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ModerationLog } = require('../models');
const config = require('../config');

// Initialize Gemini client — only if API key is provided
let genAI = null;
let model = null;

if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
  // Use gemini-3.5-flash-lite — fast, lightweight, and free-tier friendly
  model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
}

/**
 * Moderate message content using Gemini API
 *
 * @param {string} content — The message text to check
 * @param {string} senderId — Who sent it (for logging)
 * @returns {{ flagged: boolean, reason: string }}
 */
const moderateContent = async (content, senderId) => {
  // If no API key configured, skip moderation (allow all)
  if (!model) {
    console.warn('⚠️  Gemini API key not set — skipping moderation');
    return { flagged: false, reason: 'moderation_disabled' };
  }

  try {
    // Short, focused prompt for fast classification
    const prompt = `You are a content moderation classifier. Analyze the following message and respond with ONLY a JSON object (no markdown, no explanation).

Classify the message as either "clean" or "flagged". If flagged, provide a short reason.

Categories to flag: harassment, hate_speech, explicit_sexual, threats, self_harm, spam

Message: "${content}"

Respond ONLY with: {"flagged": true/false, "reason": "category or clean"}`;

    // Set a 3-second timeout — if Gemini is slow, allow the message
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Moderation timeout')), 3000),
    );

    const resultPromise = model.generateContent(prompt);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    const text = result.response.text().trim();

    // Parse the JSON response
    // Remove markdown code block markers if present
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Log the moderation check
    await ModerationLog.create({
      senderId,
      content,
      flagged: parsed.flagged || false,
      reason: parsed.reason || 'clean',
    });

    return {
      flagged: parsed.flagged || false,
      reason: parsed.reason || 'clean',
    };
  } catch (error) {
    // TIMEOUT or ERROR — fail open (allow the message)
    console.error('Moderation error:', error.message);

    // Log the timeout/error for async review
    await ModerationLog.create({
      senderId,
      content,
      flagged: false,
      reason: error.message === 'Moderation timeout'
        ? 'timeout_fallback'
        : `error_fallback: ${error.message}`,
    }).catch(() => {}); // Don't let logging failure crash the flow

    return { flagged: false, reason: 'timeout_fallback' };
  }
};

module.exports = { moderateContent };
