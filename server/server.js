/**
 * server.js — Application entry point
 *
 * WHAT THIS FILE DOES:
 * 1. Loads environment variables (via config)
 * 2. Creates the Express app with security middleware
 * 3. Creates an HTTP server and attaches Socket.io to it
 * 4. Connects to MongoDB
 * 5. Mounts API routes
 * 6. Initialises socket event handlers
 * 7. Starts listening
 *
 * WHY Express + http.createServer:
 * Express alone can't do WebSockets. Socket.io needs a raw Node HTTP server
 * to "upgrade" HTTP connections to WebSocket connections. So we create the
 * HTTP server ourselves and pass Express into it as the request handler,
 * then hand the same server to Socket.io. All three share one port.
 */

const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config');
const connectDB = require('./config/db');

// ─── 1. Create Express app ──────────────────────────────────────────
const app = express();

// ─── 2. Security middleware ─────────────────────────────────────────
// helmet: sets various HTTP headers to prevent common attacks
// (XSS, clickjacking, MIME-sniffing, etc.)
app.use(helmet());

// cors: only allow requests from our frontend origin
app.use(cors({
  origin: config.clientUrl,
  credentials: true, // allow cookies / auth headers
}));

// Parse JSON request bodies (for POST /api/auth/register, etc.)
app.use(express.json({ limit: '5mb' })); // 5MB limit for base64 avatar uploads

// ─── 3. Create HTTP server + Socket.io ──────────────────────────────
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // DESIGN DECISION: pingTimeout and pingInterval control how quickly
  // we detect disconnected clients. Lower values = faster detection
  // but more network overhead. These defaults are reasonable for chat.
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// Make io accessible in route handlers if needed
// (e.g., to emit events from REST endpoints like the save-message route)
app.set('io', io);

// ─── 4. Health-check route ──────────────────────────────────────────
// Useful for Render/Vercel to verify the server is alive
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 5. API routes ──────────────────────────────────────────────────
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter); // General rate limit on all API routes

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/payment', require('./routes/payment'));

// ─── 6. Socket.io handlers ──────────────────────────────────────────
require('./sockets')(io);

// ─── 7. Connect to DB and start server ──────────────────────────────
const start = async () => {
  await connectDB();

  server.listen(config.port, () => {
    console.log(`🚀 MiniChat server running on port ${config.port}`);
    console.log(`   CORS origin: ${config.clientUrl}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

start();

// Export for testing purposes
module.exports = { app, server, io };
