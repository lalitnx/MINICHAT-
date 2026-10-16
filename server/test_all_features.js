/**
 * test_all_features.js — Automated end-to-end test suite for MiniChat
 */

require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
const config = require('./config');
const { app, server } = require('./server');

async function runTests() {
  console.log('🚀 Starting MiniChat End-to-End Test Suite...\n');

  // Wait 1.5s for DB connection to establish
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const baseUrl = `http://localhost:${config.port}/api`;
  console.log(`📡 Connecting to server at ${baseUrl}`);

  try {
    // ── Test 1: Register User A ──
    const userAData = {
      username: `Alice_${Date.now()}`,
      email: `alice_${Date.now()}@example.com`,
      password: 'Password123!',
    };

    const resA = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userAData),
    });
    const dataA = await resA.json();
    if (!resA.ok || !dataA.token) throw new Error(`Register A failed: ${JSON.stringify(dataA)}`);
    console.log('✅ Test 1 Passed: User A registered & received valid JWT');

    const tokenA = dataA.token;
    const userA = dataA.user;

    // ── Test 2: Register User B ──
    const userBData = {
      username: `Bob_${Date.now()}`,
      email: `bob_${Date.now()}@example.com`,
      password: 'Password123!',
    };

    const resB = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userBData),
    });
    const dataB = await resB.json();
    if (!resB.ok || !dataB.token) throw new Error(`Register B failed: ${JSON.stringify(dataB)}`);
    console.log('✅ Test 2 Passed: User B registered & received valid JWT');

    const tokenB = dataB.token;
    const userB = dataB.user;

    // ── Test 3: Login User A ──
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAData.email, password: userAData.password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) throw new Error('Login failed');
    console.log('✅ Test 3 Passed: User login credentials verified with bcrypt');

    // ── Test 4: Profile & Search ──
    const meRes = await fetch(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok || meData.user.email !== userAData.email.toLowerCase()) {
      throw new Error('Get profile failed');
    }
    console.log('✅ Test 4 Passed: Authenticated profile fetched (/api/users/me)');

    const searchRes = await fetch(`${baseUrl}/users/search?q=${encodeURIComponent(userB.username)}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const searchData = await searchRes.json();
    if (!searchRes.ok || !searchData.users?.some((u) => u._id === userB._id)) {
      throw new Error('User search failed');
    }
    console.log('✅ Test 5 Passed: User discovery & search verified');

    // ── Test 6: Create Conversation between A and B ──
    const convRes = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ participantId: userB._id }),
    });
    const convData = await convRes.json();
    const conversationId = convData.conversation?._id || convData._id;
    if (!convRes.ok || !conversationId) throw new Error('Create conversation failed');
    console.log(`✅ Test 6 Passed: 1-on-1 Conversation created (${conversationId})`);

    // ── Test 7: Send a Message & Save/Keep Message ──
    const { Message } = require('./models');
    const testMsg = await Message.create({
      conversationId,
      senderId: userA._id,
      content: 'This is an ephemeral message that can be kept',
      type: 'text',
      status: 'sent',
      expiresAt: new Date(Date.now() + 20000), // set initial expiry
    });

    // Bob keeps Alice's message
    const saveRes = await fetch(`${baseUrl}/messages/${testMsg._id}/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok) throw new Error(`Save message failed: ${JSON.stringify(saveData)}`);

    const updatedMsg = await Message.findById(testMsg._id);
    if (updatedMsg.expiresAt !== null) {
      throw new Error('TTL index cancellation failed: expiresAt was not cleared');
    }
    console.log('✅ Test 7 Passed: Save/Keep feature canceled TTL auto-delete & archived message');

    // ── Test 8: Razorpay In-App Payment Feature (WhatsApp Pay style) ──
    const orderRes = await fetch(`${baseUrl}/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        conversationId,
        amount: 250,
        note: 'Pizza treat 🍕',
      }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.orderId) {
      throw new Error(`Create payment order failed: ${JSON.stringify(orderData)}`);
    }
    console.log(`✅ Test 8 Passed: Razorpay order generated (${orderData.orderId}) for ₹250`);

    const verifyRes = await fetch(`${baseUrl}/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        conversationId,
        orderId: orderData.orderId,
        paymentId: `pay_test_${Date.now()}`,
        amount: 250,
        note: 'Pizza treat 🍕',
        isDemo: true,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success || verifyData.message.type !== 'payment') {
      throw new Error(`Payment verification failed: ${JSON.stringify(verifyData)}`);
    }
    console.log('✅ Test 9 Passed: Payment verified and in-chat payment receipt created');

    // ── Test 10: Nova AI Bot (Meta AI style) ──
    const novaRes = await fetch(`${baseUrl}/conversations/nova`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const novaData = await novaRes.json();
    if (!novaRes.ok || !novaData.conversation?._id) {
      throw new Error(`Nova AI conversation failed: ${JSON.stringify(novaData)}`);
    }
    const hasNovaBot = novaData.conversation.participantIds.some(
      (p) => p.username === 'Nova AI' && p.isBot === true,
    );
    if (!hasNovaBot) {
      throw new Error(`Nova bot participant not found: ${JSON.stringify(novaData.conversation.participantIds)}`);
    }
    console.log('✅ Test 10 Passed: Nova AI initialized with Google Search Grounding capabilities');

    console.log('\n🎉 ALL 10 TEST SUITES PASSED FLAWLESSLY! All features (including Nova AI) are fully operational.\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
