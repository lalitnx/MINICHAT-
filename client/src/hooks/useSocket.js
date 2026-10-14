/**
 * hooks/useSocket.js — Socket.io event management hook
 *
 * WHY a custom hook: Components that need real-time data (messages,
 * typing indicators, online status) would each need to manage
 * socket.on() and socket.off() listeners manually. This hook
 * standardises that pattern and handles cleanup automatically.
 */

import { useEffect, useRef, useCallback } from 'react';
import socket from '../services/socket';

/**
 * Subscribe to a socket event and auto-cleanup on unmount.
 *
 * Usage:
 *   useSocketEvent('receive_message', (data) => {
 *     setMessages(prev => [...prev, data]);
 *   });
 */
export function useSocketEvent(event, handler) {
  const savedHandler = useRef(handler);

  // Update ref on each render so the latest closure is used
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (...args) => savedHandler.current(...args);
    socket.on(event, listener);

    // Cleanup: remove listener when component unmounts
    return () => {
      socket.off(event, listener);
    };
  }, [event]);
}

/**
 * Emit a socket event (wrapper for convenience).
 */
export function useSocketEmit() {
  const emit = useCallback((event, data, callback) => {
    socket.emit(event, data, callback);
  }, []);

  return emit;
}

export default socket;
