/**
 * services/novaService.js — Nova AI chatbot service using Google Gemini API
 *
 * WHAT THIS SERVICE DOES:
 * 1. Manages Nova AI's bot identity (like Meta AI in WhatsApp).
 * 2. Connects to Google Gemini API with smart model fallback (Gemini 3.5 Flash & Lite).
 * 3. Supports Google Search Grounding when available, with resilient live web search fallback.
 * 4. Handles conversation creation, multi-turn chat history, and web citations.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { User, Conversation, Message } = require('../models');
const config = require('../config');

const NOVA_EMAIL = 'nova@minichat.ai';
const NOVA_USERNAME = 'Nova AI';
const NOVA_INVITE = 'NOVA';

// Priority order of Gemini models for maximum reliability and uptime
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Ensures Nova AI bot user exists in the database
 */
const getNovaUser = async () => {
  let nova = await User.findOne({ email: NOVA_EMAIL });
  if (!nova) {
    nova = await User.create({
      username: NOVA_USERNAME,
      email: NOVA_EMAIL,
      passwordHash: 'BOT_ACCOUNT_NO_LOGIN',
      avatarUrl: 'bot_nova',
      inviteCode: NOVA_INVITE,
      isBot: true,
    });
  } else if (!nova.isBot) {
    nova.isBot = true;
    await nova.save();
  }
  return nova;
};

/**
 * Get or create 1-on-1 conversation between a user and Nova AI
 */
const getOrCreateNovaConversation = async (userId) => {
  const novaUser = await getNovaUser();

  let conversation = await Conversation.findOne({
    participantIds: { $all: [userId, novaUser._id], $size: 2 },
    isGroup: false,
  }).populate('participantIds', 'username avatarUrl inviteCode isBot');

  if (!conversation) {
    conversation = await Conversation.create({
      participantIds: [userId, novaUser._id],
      isGroup: false,
      lastMessageAt: new Date(),
    });

    // Seed friendly welcome message
    await Message.create({
      conversationId: conversation._id,
      senderId: novaUser._id,
      type: 'text',
      content:
        "👋 Hi! I'm **Nova**, your AI assistant on MiniChat (like Meta AI in WhatsApp)!\n\nAsk me anything! I can answer questions, explain concepts, write code, or search the live web for the latest news, scores, facts, and live information.\n\nWhat would you like to explore today? ✨",
      isAi: true,
      status: 'delivered',
      expiresAt: null,
    });

    conversation = await Conversation.findById(conversation._id).populate(
      'participantIds',
      'username avatarUrl inviteCode isBot',
    );
  }

  return conversation;
};

/**
 * Fallback live web search using DuckDuckGo / Wikipedia APIs
 * Used when Google Search Grounding tool is rate-limited or unavailable on free tiers
 */
const fetchLiveWebContext = async (query) => {
  const results = [];
  try {
    // 1. DuckDuckGo Instant Answer API
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const ddgRes = await fetch(ddgUrl, { signal: AbortSignal.timeout(3500) });
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText,
          url: data.AbstractURL,
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text && topic.FirstURL && !results.some((r) => r.url === topic.FirstURL)) {
            results.push({
              title: topic.Text.split(' - ')[0]?.trim() || topic.Text.slice(0, 35),
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
    }
  } catch (err) {
    // Non-fatal, continue to Wikipedia
  }

  // 2. Wikipedia search fallback if needed
  if (results.length === 0) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=2&namespace=0&format=json`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(3000) });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const titles = wikiData[1] || [];
        const snippets = wikiData[2] || [];
        const urls = wikiData[3] || [];
        for (let i = 0; i < titles.length; i++) {
          if (urls[i]) {
            results.push({
              title: titles[i],
              snippet: snippets[i] || titles[i],
              url: urls[i],
            });
          }
        }
      }
    } catch (wikiErr) {
      // Non-fatal
    }
  }

  return results;
};

/**
 * Format multi-turn conversation history into valid Gemini API contents.
 * Rules:
 * - Roles strictly alternate: user -> model -> user -> model
 * - The first turn must be user
 * - Consecutive messages with the same role are combined
 * - The last turn is the user's latest prompt
 */
const formatChatHistory = (recentMessages, currentPrompt, novaUserId) => {
  const turns = [];
  const novaIdStr = novaUserId.toString();

  for (const msg of recentMessages) {
    if (!msg.content || typeof msg.content !== 'string') continue;
    const isBot = msg.isAi || msg.senderId?.toString() === novaIdStr;
    const role = isBot ? 'model' : 'user';

    // Gemini requires the first turn to be 'user'
    if (turns.length === 0 && role === 'model') continue;

    if (turns.length > 0 && turns[turns.length - 1].role === role) {
      turns[turns.length - 1].parts[0].text += '\n' + msg.content;
    } else {
      turns.push({
        role,
        parts: [{ text: msg.content }],
      });
    }
  }

  // Ensure current user prompt is properly set as the final user turn
  if (turns.length === 0) {
    turns.push({ role: 'user', parts: [{ text: currentPrompt }] });
  } else if (turns[turns.length - 1].role === 'user') {
    // If the last turn was already the user's prompt (e.g. from DB save), ensure text matches
    if (!turns[turns.length - 1].parts[0].text.includes(currentPrompt)) {
      turns[turns.length - 1].parts[0].text = currentPrompt;
    }
  } else {
    turns.push({ role: 'user', parts: [{ text: currentPrompt }] });
  }

  return turns;
};

/**
 * Generate Nova AI response using Google Gemini API with smart fallbacks
 *
 * @param {Object} options
 * @param {string} options.conversationId
 * @param {string} options.prompt - The question/message asked by user
 * @param {string} [options.senderId]
 * @returns {Promise<Object>} Populated Message object
 */
const askNova = async ({ conversationId, prompt, senderId }) => {
  const novaUser = await getNovaUser();

  // If no Gemini API key configured, guide user to set it up
  if (!config.geminiApiKey) {
    const fallbackMessage = await Message.create({
      conversationId,
      senderId: novaUser._id,
      type: 'text',
      content:
        '⚠️ **Gemini API Key Required**\n\nTo activate my AI intelligence and live web search, please add your `GEMINI_API_KEY` into `server/.env` and restart the server.\n\nYou can generate a free key at [Google AI Studio](https://aistudio.google.com/apikey).',
      isAi: true,
      status: 'delivered',
      expiresAt: null,
    });

    return Message.findById(fallbackMessage._id)
      .populate('senderId', 'username avatarUrl isBot')
      .lean();
  }

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);

    // Fetch last 8 messages for multi-turn conversation context
    const recentMessages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    recentMessages.reverse();

    const contents = formatChatHistory(recentMessages, prompt, novaUser._id);

    const systemInstruction =
      "You are Nova, an intelligent, helpful, and friendly AI assistant built into MiniChat (inspired by Meta AI in WhatsApp). " +
      "Answer user questions clearly, concisely, and helpfully. " +
      "When live web data or search context is provided, synthesize the facts accurately and naturally. " +
      "Keep your tone approachable and modern. " +
      "Format your responses with clean Markdown (bold, bullet points, emojis, code blocks) so they look great in chat bubbles.";

    let replyText = '';
    let groundingSources = [];
    let generationSuccess = false;

    // Check if the user is asking for real-time / web / search information
    const isSearchQuery = /\b(latest|news|today|current|recent|who is|what is|search|live|score|weather|when was|price|stock|update)\b/i.test(prompt);

    // 1. Attempt Native Google Search Grounding with Gemini 3.5 Flash (if applicable)
    if (isSearchQuery) {
      try {
        const modelWithSearch = genAI.getGenerativeModel({
          model: 'gemini-3.5-flash',
          systemInstruction,
          tools: [{ googleSearch: {} }],
        });

        const searchResult = await modelWithSearch.generateContent({ contents });
        const candidate = searchResult.response.candidates?.[0];
        const text = searchResult.response.text().trim();

        if (text) {
          replyText = text;
          generationSuccess = true;

          // Extract Google Search citations
          const metadata = candidate?.groundingMetadata;
          if (Array.isArray(metadata?.groundingChunks)) {
            for (const chunk of metadata.groundingChunks) {
              if (chunk.web?.uri) {
                const url = chunk.web.uri;
                const title = chunk.web.title || url;
                if (!groundingSources.some((s) => s.url === url)) {
                  groundingSources.push({ title, url });
                }
              }
            }
          }
        }
      } catch (searchError) {
        // Search Grounding quota (429) or model unavailability is caught cleanly
        console.warn('Google Search Grounding unavailable, using live web context fallback:', searchError.message);
      }
    }

    // 2. If native search was not used or failed, fetch live web context if needed
    if (!generationSuccess && isSearchQuery) {
      const webResults = await fetchLiveWebContext(prompt);
      if (webResults.length > 0) {
        groundingSources = webResults.map((r) => ({ title: r.title, url: r.url }));
        const webSummary = webResults
          .map((r) => `• [${r.title}](${r.url}): ${r.snippet}`)
          .join('\n');

        // Append live web context to the user's latest prompt turn
        const lastTurn = contents[contents.length - 1];
        lastTurn.parts[0].text += `\n\n[Live Web Information]:\n${webSummary}\n\nPlease synthesize a concise, helpful answer referencing this live information where relevant.`;
      }
    }

    // 3. Resilient model cascade: try fast & lightweight models in order
    if (!generationSuccess) {
      let lastError = null;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction,
          });

          const result = await model.generateContent({ contents });
          const text = result.response.text().trim();
          if (text) {
            replyText = text;
            generationSuccess = true;
            break;
          }
        } catch (modelErr) {
          lastError = modelErr;
          console.warn(`Model ${modelName} attempt failed (${modelErr.message}), trying next candidate...`);
        }
      }

      if (!generationSuccess && lastError) {
        throw lastError;
      }
    }

    // Save Nova's response to DB
    const savedMessage = await Message.create({
      conversationId,
      senderId: novaUser._id,
      type: 'text',
      content: replyText,
      isAi: true,
      groundingSources,
      status: 'delivered',
      expiresAt: null, // Keep Nova messages permanent so user can refer back
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
    });

    return Message.findById(savedMessage._id)
      .populate('senderId', 'username avatarUrl isBot')
      .lean();
  } catch (err) {
    console.error('Nova AI generation error:', err.message);

    const errorMessage = await Message.create({
      conversationId,
      senderId: novaUser._id,
      type: 'text',
      content:
        `Sorry, I encountered an issue processing your request: ${err.message}. Please try asking again in a moment!`,
      isAi: true,
      status: 'delivered',
      expiresAt: null,
    });

    return Message.findById(errorMessage._id)
      .populate('senderId', 'username avatarUrl isBot')
      .lean();
  }
};

module.exports = {
  getNovaUser,
  getOrCreateNovaConversation,
  askNova,
  NOVA_EMAIL,
  NOVA_USERNAME,
};
