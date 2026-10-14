/**
 * routes/payment.js — Payment endpoints (Razorpay)
 */

const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// POST /api/payment/create-order — Create Razorpay order
router.post('/create-order', createOrder);

// POST /api/payment/verify — Verify Razorpay signature & record transaction
router.post('/verify', verifyPayment);

module.exports = router;
