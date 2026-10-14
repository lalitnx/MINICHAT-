/**
 * sockets/handlers/callHandler.js — WebRTC Voice & Video Call Signaling
 *
 * WHAT: Enables direct peer-to-peer audio and video calls between users (WhatsApp style).
 *
 * EVENTS:
 * - call_user      → Initiator starts a call with SDP offer & callType ('audio' | 'video')
 * - answer_call    → Receiver answers call with SDP answer
 * - ice_candidate  → P2P ICE candidate exchange
 * - end_call       → Either party hangs up
 * - reject_call    → Receiver declines call
 */

const registerCallHandlers = (io, socket) => {
  const userId = socket.userId;
  const username = socket.username;

  // 1. Initiate call
  socket.on('call_user', ({ userToCall, signalData, callType = 'video' }) => {
    io.to(`user:${userToCall}`).emit('incoming_call', {
      signal: signalData,
      from: userId,
      fromUsername: username,
      callType,
    });
  });

  // 2. Answer call
  socket.on('answer_call', ({ to, signal }) => {
    io.to(`user:${to}`).emit('call_accepted', { signal });
  });

  // 3. ICE Candidate exchange
  socket.on('ice_candidate', ({ to, candidate }) => {
    if (candidate) {
      io.to(`user:${to}`).emit('ice_candidate', { candidate });
    }
  });

  // 4. Hang up / End call
  socket.on('end_call', ({ to }) => {
    io.to(`user:${to}`).emit('call_ended');
  });

  // 5. Reject incoming call
  socket.on('reject_call', ({ to }) => {
    io.to(`user:${to}`).emit('call_rejected');
  });
};

module.exports = registerCallHandlers;
