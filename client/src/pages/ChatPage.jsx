import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useScreenshotDeterrent } from '../hooks/useScreenshotDeterrent';
import api from '../services/api';
import socket from '../services/socket';
import toast from 'react-hot-toast';
import ExpiringMessage from '../components/Chat/ExpiringMessage';
import VoicePlayer from '../components/Chat/VoicePlayer';
import VoiceRecorder from '../components/Chat/VoiceRecorder';
import PaymentModal from '../components/Chat/PaymentModal';
import CallModal from '../components/Chat/CallModal';
import ThemeToggle from '../components/Common/ThemeToggle';
import styles from './ChatPage.module.css';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { isBlurred, preventContextMenu } = useScreenshotDeterrent();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Modals & Active Controls
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Call State (Voice / Video)
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callType, setCallType] = useState('video'); // 'audio' | 'video'
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Online & Typing state
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll ref
  const messagesEndRef = useRef(null);

  // Expiry timer tick (forces re-render every second to update countdowns)
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── 1. Load Conversations ──────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data.conversations || data || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ─── 2. Socket Listeners for Online Presence, Messages & Calls ──────
  useEffect(() => {
    const handleOnlineUsers = ({ userIds }) => {
      setOnlineUsers(new Set(userIds));
    };

    const handleUserOnline = ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    };

    const handleUserOffline = ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const handleReceiveMessage = (newMessage) => {
      if (activeConversation && newMessage.conversationId === activeConversation._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });

        // Mark as seen immediately if received from the other user
        const senderId = newMessage.senderId?._id || newMessage.senderId;
        if (senderId !== user._id) {
          socket.emit('message_seen', {
            messageId: newMessage._id,
            conversationId: activeConversation._id,
          });
        }
      }

      fetchConversations();
    };

    const handleMessageStatusUpdate = ({ messageId, status, seenAt, expiresAt }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status, seenAt, expiresAt } : msg,
        ),
      );
    };

    const handleMessageSaved = ({ messageId, savedByUserId }) => {
      if (savedByUserId !== user._id) {
        toast('A participant saved your message (it won’t self-destruct)!', {
          icon: '🔖',
          duration: 4000,
        });
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, isSaved: true, expiresAt: null } : msg,
        ),
      );
    };

    const handleUserTyping = ({ conversationId, userId }) => {
      if (activeConversation && conversationId === activeConversation._id && userId !== user._id) {
        setPartnerTyping(true);
      }
    };

    const handleUserStopTyping = ({ conversationId, userId }) => {
      if (activeConversation && conversationId === activeConversation._id && userId !== user._id) {
        setPartnerTyping(false);
      }
    };

    // WebRTC Incoming Call listener
    const handleIncomingCall = ({ signal, from, fromUsername, callType: incomingType }) => {
      setIncomingCallData({ signal, from, username: fromUsername });
      setCallType(incomingType || 'video');
      setIsIncomingCall(true);
      setIsCallOpen(true);
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_status_update', handleMessageStatusUpdate);
    socket.on('message_saved', handleMessageSaved);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('incoming_call', handleIncomingCall);

    // Request fresh online users list
    socket.emit('get_online_users');

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_status_update', handleMessageStatusUpdate);
      socket.off('message_saved', handleMessageSaved);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('incoming_call', handleIncomingCall);
    };
  }, [activeConversation, user._id, fetchConversations]);

  // ─── 3. Load Active Conversation Messages ───────────────────────────
  useEffect(() => {
    if (!activeConversation) return;

    socket.emit('join_conversation', { conversationId: activeConversation._id });
    setPartnerTyping(false);

    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/conversations/${activeConversation._id}`);
        const loadedMessages = data.messages || [];
        setMessages(loadedMessages);

        // Mark any unseen received messages as seen
        loadedMessages.forEach((msg) => {
          const senderId = msg.senderId?._id || msg.senderId;
          if (senderId !== user._id && msg.status !== 'seen') {
            socket.emit('message_seen', {
              messageId: msg._id,
              conversationId: activeConversation._id,
            });
          }
        });
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    loadMessages();

    return () => {
      socket.emit('leave_conversation', { conversationId: activeConversation._id });
    };
  }, [activeConversation, user._id]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // ─── 4. Search Users ────────────────────────────────────────────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const results = (data.users || data || []).filter((u) => u._id !== user._id);
        setSearchResults(results);
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user._id]);

  const handleStartChat = async (targetUser) => {
    try {
      const { data } = await api.post('/conversations', {
        participantId: targetUser._id,
      });
      const conv = data.conversation || data;
      setSearchQuery('');
      setSearchResults([]);
      await fetchConversations();
      setActiveConversation(conv);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start conversation');
    }
  };

  // Quick Demo Chat button for testing all features instantly
  const handleQuickDemoChat = async () => {
    try {
      const { data } = await api.get('/users/search?q=a');
      const otherUsers = (data.users || []).filter((u) => u._id !== user._id);
      if (otherUsers.length > 0) {
        handleStartChat(otherUsers[0]);
      } else {
        toast('Open an Incognito Tab (Ctrl+Shift+N) to register a 2nd user, or search a username!', {
          icon: '💡',
          duration: 5000,
        });
      }
    } catch (err) {
      toast.error('Search for another user above to start chatting!');
    }
  };

  // ─── 5. Send Message ────────────────────────────────────────────────
  const handleSendMessage = (e) => {
    e.preventDefault();
    const content = inputMessage.trim();
    if (!content || !activeConversation || isSending) return;

    setIsSending(true);

    // Stop typing indicator
    socket.emit('stop_typing', { conversationId: activeConversation._id });

    socket.emit(
      'send_message',
      {
        conversationId: activeConversation._id,
        content,
        type: 'text',
      },
      (response) => {
        setIsSending(false);
        if (response?.error) {
          toast.error(response.error);
        } else {
          setInputMessage('');
        }
      },
    );
  };

  // Send Voice Message
  const handleSendVoice = (base64Audio, durationStr) => {
    if (!activeConversation) return;

    socket.emit(
      'send_message',
      {
        conversationId: activeConversation._id,
        type: 'voice',
        voiceUrl: base64Audio,
        content: `Voice note (${durationStr})`,
      },
      (response) => {
        setIsRecordingVoice(false);
        if (response?.error) {
          toast.error(response.error);
        } else {
          toast.success('Voice message sent');
        }
      },
    );
  };

  // ─── 6. Typing Handlers ─────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (!activeConversation) return;

    socket.emit('typing', { conversationId: activeConversation._id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: activeConversation._id });
    }, 2000);
  };

  // ─── 7. Save / Keep Message ─────────────────────────────────────────
  const handleSaveMessage = async (msgId) => {
    try {
      await api.post(`/messages/${msgId}/save`);
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, isSaved: true, expiresAt: null } : m)),
      );
      toast.success('Message saved to your archive! (Won’t self-destruct)');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save message');
    }
  };

  const handleMessageExpired = (msgId) => {
    setMessages((prev) => prev.filter((m) => m._id !== msgId));
  };

  // ─── 8. Voice & Video Calls ─────────────────────────────────────────
  const handleStartCall = (type) => {
    const partner = activeConversation ? getPartner(activeConversation) : null;
    if (!partner?._id) {
      toast.error('Cannot initiate call');
      return;
    }
    setCallType(type);
    setIsIncomingCall(false);
    setIsCallOpen(true);
  };

  // ─── Helpers ────────────────────────────────────────────────────────
  const getPartner = (conv) => {
    return (
      conv.participantIds?.find((p) => (p._id || p) !== user._id) || {
        username: 'Unknown User',
      }
    );
  };

  const copyInviteCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      toast.success(`Invite code copied: ${user.inviteCode}`);
    }
  };

  const formatRemainingSeconds = (expiresAt) => {
    if (!expiresAt) return null;
    const remaining = Math.max(0, Math.round((new Date(expiresAt) - new Date()) / 1000));
    return remaining;
  };

  const activePartner = activeConversation ? getPartner(activeConversation) : null;
  const isPartnerOnline = activePartner && onlineUsers.has(activePartner._id);

  return (
    <div
      className={`${styles.chatContainer} ${isBlurred ? styles.blurred : ''}`}
      onContextMenu={preventContextMenu}
    >
      {/* ─── Sidebar ───────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.userHeader}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.username}</span>
              {user?.inviteCode && (
                <div
                  className={styles.inviteBadge}
                  onClick={copyInviteCode}
                  title="Click to copy your unique invite code"
                >
                  <span>🔑 {user.inviteCode}</span>
                  <span style={{ opacity: 0.6 }}>📋</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ThemeToggle />
            <button className={styles.logoutBtn} onClick={logout} title="Sign Out">
              Logout
            </button>
          </div>
        </div>

        {/* Search Users */}
        <div className={styles.searchSection}>
          <div className={styles.searchInputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search username or invite code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery.trim() && (
            <div className={styles.searchResults}>
              {isSearching ? (
                <div style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#888' }}>
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#888' }}>
                  No users found
                </div>
              ) : (
                searchResults.map((result) => (
                  <div key={result._id} className={styles.searchResultItem}>
                    <div>
                      <div className={styles.searchResultName}>{result.username}</div>
                      <div className={styles.searchResultCode}>Code: {result.inviteCode}</div>
                    </div>
                    <button
                      className={styles.startChatBtn}
                      onClick={() => handleStartChat(result)}
                    >
                      Chat
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className={styles.conversationList}>
          <div className={styles.listHeader}>Conversations</div>
          {conversations.length === 0 ? (
            <div className={styles.emptyConversations}>
              No conversations yet.<br />Search a username above to start chatting!
            </div>
          ) : (
            conversations.map((conv) => {
              const partner = getPartner(conv);
              const isOnline = partner && onlineUsers.has(partner._id);
              const isActive = activeConversation?._id === conv._id;

              return (
                <div
                  key={conv._id}
                  className={`${styles.conversationItem} ${isActive ? styles.active : ''}`}
                  onClick={() => setActiveConversation(conv)}
                >
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatar} style={{ width: 38, height: 38, fontSize: '0.95rem' }}>
                      {partner?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    {isOnline && <div className={styles.onlineDot} />}
                  </div>

                  <div className={styles.convDetails}>
                    <div className={styles.convTop}>
                      <span className={styles.convName}>{partner?.username}</span>
                      {conv.lastMessageAt && (
                        <span className={styles.convTime}>
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className={styles.convBottom}>
                      <span className={styles.lastMsg}>
                        {conv.lastMessage?.type === 'voice'
                          ? '🎤 Voice note'
                          : conv.lastMessage?.type === 'payment'
                          ? `💳 Paid ₹${conv.lastMessage?.paymentDetails?.amount || ''}`
                          : conv.lastMessage?.content || 'No messages yet'}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className={styles.unreadBadge}>{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── Main Chat Window ────────────────────────────────────────── */}
      <main className={styles.chatMain}>
        {!activeConversation ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛡️</div>
            <h2 className={styles.emptyTitle}>MiniChat Ephemeral Messaging</h2>
            <p className={styles.emptySubtitle}>
              Select a conversation from the sidebar or search a user by their username or invite
              code to begin chatting privately.
            </p>

            <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleQuickDemoChat}
                style={{
                  background: 'var(--accent-gradient, linear-gradient(135deg, #6c3ce0, #a78bfa))',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem 1.6rem',
                  borderRadius: '24px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(108, 60, 224, 0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ⚡ Start Instant Chat with Registered Users
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #888)' }}>
                Tip: Search any registered username above, or open an Incognito tab to register User 2!
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={styles.chatHeader}>
              <div className={styles.headerUser}>
                <div className={styles.avatarWrapper}>
                  <div className={styles.avatar}>
                    {activePartner?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  {isPartnerOnline && <div className={styles.onlineDot} />}
                </div>
                <div>
                  <div className={styles.headerTitle}>{activePartner?.username}</div>
                  <div className={`${styles.headerStatus} ${isPartnerOnline ? styles.online : ''}`}>
                    {partnerTyping ? (
                      <span className={styles.typingText}>typing...</span>
                    ) : isPartnerOnline ? (
                      '● Online'
                    ) : (
                      'Offline'
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons in Header: Voice Call, Video Call, Razorpay Pay */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => handleStartCall('audio')}
                  className={styles.headerActionBtn}
                  title="Voice Call"
                >
                  📞
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCall('video')}
                  className={styles.headerActionBtn}
                  title="Video Call"
                >
                  📹
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className={styles.headerPayBtn}
                  title="Send Money via Razorpay"
                >
                  <span>💳</span>
                  <span>Pay ₹</span>
                </button>
              </div>
            </div>

            {/* Ephemeral Notice Banner */}
            <div className={styles.ephemeralBanner}>
              <span>🔥</span>
              <span>Messages self-destruct 15–25 seconds after being read by recipient.</span>
            </div>

            {/* Messages Scroll Area */}
            <div className={styles.messagesScroll}>
              {messages.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                  }}
                >
                  No messages yet. Say hello! 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const senderId = msg.senderId?._id || msg.senderId;
                  const isSent = senderId === user._id;
                  const remainingSec = formatRemainingSeconds(msg.expiresAt);

                  return (
                    <div
                      key={msg._id}
                      className={`${styles.messageRow} ${isSent ? styles.sent : styles.received}`}
                    >
                      <ExpiringMessage
                        expiresAt={msg.isSaved || msg.type === 'payment' ? null : msg.expiresAt}
                        onExpired={() => handleMessageExpired(msg._id)}
                      >
                        {/* ─── Voice Message ─── */}
                        {msg.type === 'voice' ? (
                          <div className={styles.messageBubble}>
                            <VoicePlayer src={msg.voiceUrl} />
                          </div>
                        ) : msg.type === 'payment' ? (
                          /* ─── WhatsApp Pay Style Payment Receipt ─── */
                          <div className={styles.paymentCard}>
                            <div className={styles.paymentCardHeader}>
                              <span>💳 MiniChat Pay</span>
                              <span className={styles.paymentSuccessBadge}>✓ Paid</span>
                            </div>
                            <div className={styles.paymentAmount}>
                              ₹{msg.paymentDetails?.amount || 0}
                            </div>
                            <div className={styles.paymentNote}>
                              {msg.content || 'Direct payment transfer'}
                            </div>
                          </div>
                        ) : (
                          /* ─── Text Message ─── */
                          <div className={styles.messageBubble}>{msg.content}</div>
                        )}
                      </ExpiringMessage>

                      <div className={styles.messageFooter}>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {isSent && (
                          <span title={msg.status === 'seen' ? 'Seen' : 'Sent'}>
                            {msg.status === 'seen' ? '✓✓' : '✓'}
                          </span>
                        )}

                        {remainingSec !== null && !msg.isSaved && msg.type !== 'payment' && (
                          <span
                            className={styles.expiryBadge}
                            title="Self-destruct timer counting down"
                          >
                            ⏳ {remainingSec}s
                          </span>
                        )}

                        {msg.type !== 'payment' &&
                          (msg.isSaved ? (
                            <span className={styles.savedBadge} title="Saved in your archive">
                              🔖 Saved
                            </span>
                          ) : (
                            <button
                              className={styles.saveBtn}
                              onClick={() => handleSaveMessage(msg._id)}
                              title="Save message before it disappears"
                            >
                              🔖 Keep
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input or Voice Recorder */}
            {isRecordingVoice ? (
              <div className={styles.inputForm}>
                <VoiceRecorder
                  onSendVoice={handleSendVoice}
                  onCancel={() => setIsRecordingVoice(false)}
                />
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className={styles.inputForm}>
                {/* Razorpay WhatsApp Pay Button */}
                <button
                  type="button"
                  className={styles.headerPayBtn}
                  onClick={() => setIsPaymentModalOpen(true)}
                  title="Send Money (WhatsApp Pay / Razorpay)"
                  style={{ borderRadius: '20px', padding: '0.5rem 0.85rem' }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>💳 Pay ₹</span>
                </button>

                {/* Voice Note Button */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setIsRecordingVoice(true)}
                  title="Record Voice Note"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                <input
                  type="text"
                  className={styles.messageInput}
                  placeholder="Send an ephemeral message..."
                  value={inputMessage}
                  onChange={handleInputChange}
                  disabled={isSending}
                  autoFocus
                />

                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={!inputMessage.trim() || isSending}
                  title="Send Message"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            )}

            {/* Payment Modal */}
            <PaymentModal
              conversationId={activeConversation._id}
              recipientName={activePartner?.username || 'Recipient'}
              isOpen={isPaymentModalOpen}
              onClose={() => setIsPaymentModalOpen(false)}
              onPaymentSuccess={() => {
                fetchConversations();
              }}
            />

            {/* WebRTC Audio / Video Call Modal */}
            <CallModal
              isOpen={isCallOpen}
              isIncoming={isIncomingCall}
              callType={callType}
              partner={isIncomingCall ? incomingCallData : activePartner}
              incomingSignal={incomingCallData?.signal}
              onClose={() => {
                setIsCallOpen(false);
                setIsIncomingCall(false);
                setIncomingCallData(null);
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
