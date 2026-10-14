/**
 * controllers/paymentController.js — In-App Payment (WhatsApp Pay style via Razorpay)
 *
 * WHAT: Enables direct peer-to-peer style payments inside conversations.
 *
 * FLOW (viva explainer):
 * 1. User clicks Pay icon inside a chat, enters amount (e.g. ₹100) and optional note.
 * 2. Client calls POST /api/payment/create-order.
 * 3. Server initializes Razorpay order and returns order_id + public key.
 * 4. Client opens Razorpay Checkout modal (UPI, Cards, NetBanking, Wallets).
 * 5. On successful payment, Razorpay returns payment_id, order_id, signature.
 * 6. Client calls POST /api/payment/verify.
 * 7. Server verifies cryptographic HMAC SHA256 signature to guarantee authenticity.
 * 8. On verification, a payment receipt Message (type: 'payment') is created
 *    and broadcast via Socket.io to the conversation in real time!
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config');
const { Message, Conversation } = require('../models');

// Initialize Razorpay instance if keys are provided
let razorpay = null;
const isRazorpayConfigured =
  config.razorpayKeyId &&
  config.razorpayKeySecret &&
  config.razorpayKeyId !== 'rzp_test_placeholder';

if (isRazorpayConfigured) {
  razorpay = new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  });
}

/**
 * POST /api/payment/create-order
 * Body: { conversationId, amount, note }
 */
const createOrder = async (req, res) => {
  try {
    const { conversationId, amount, note = '' } = req.body;
    const userId = req.user.userId;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than 0' });
    }

    // Verify conversation membership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participantIds: userId,
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(numericAmount * 100);

    // If live/test Razorpay keys are configured, create real order
    if (isRazorpayConfigured && razorpay) {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${Date.now()}_${conversationId.slice(-4)}`,
        notes: {
          conversationId,
          senderId: userId,
          note,
        },
      };

      const order = await razorpay.orders.create(options);

      return res.json({
        orderId: order.id,
        amount: numericAmount,
        currency: 'INR',
        keyId: config.razorpayKeyId,
        isDemo: false,
      });
    }

    // ── DEMO / TEST FALLBACK ──
    // Allows testing in viva and development without setting up an actual merchant account
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return res.json({
      orderId: mockOrderId,
      amount: numericAmount,
      currency: 'INR',
      keyId: 'rzp_test_placeholder',
      isDemo: true,
      message: 'Running in demonstration/sandbox mode',
    });
  } catch (error) {
    console.error('Razorpay createOrder error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment order' });
  }
};

/**
 * POST /api/payment/verify
 * Body: { conversationId, orderId, paymentId, signature, amount, note, isDemo }
 */
const verifyPayment = async (req, res) => {
  try {
    const { conversationId, orderId, paymentId, signature, amount, note = '', isDemo } =
      req.body;
    const userId = req.user.userId;

    if (!conversationId || !orderId) {
      return res.status(400).json({ error: 'Missing required payment verification details' });
    }

    // Verify cryptographic signature if not in demo mode
    if (!isDemo && isRazorpayConfigured) {
      const generatedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        return res.status(400).json({ error: 'Invalid payment signature. Transaction rejected.' });
      }
    }

    // Create payment message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      type: 'payment',
      content: note ? `Paid ₹${amount}: ${note}` : `Paid ₹${amount}`,
      paymentDetails: {
        amount: parseFloat(amount),
        currency: 'INR',
        orderId,
        paymentId: paymentId || `pay_mock_${Date.now()}`,
        status: 'success',
      },
      status: 'sent',
      expiresAt: null, // Keep payment records durable
    });

    // Update conversation timestamp
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'username avatarUrl')
      .lean();

    // Broadcast payment confirmation to conversation room in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('receive_message', populatedMessage);
    }

    res.json({
      success: true,
      message: populatedMessage,
    });
  } catch (error) {
    console.error('Razorpay verifyPayment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
};

module.exports = { createOrder, verifyPayment };
