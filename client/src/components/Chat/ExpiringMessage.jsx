/**
 * components/Chat/ExpiringMessage.jsx — Self-destruct countdown & dissolve animation
 *
 * WHAT THIS COMPONENT DOES:
 * Wraps message bubbles. When `expiresAt` is present (calculated upon being seen),
 * it calculates the countdown and displays:
 * 1. A subtle countdown timer progress bar at the bottom.
 * 2. In the final 3-5 seconds, a scan-line laser sweep effect across the bubble.
 * 3. A particle dissolve/blur exit animation using Framer Motion when the timer hits 0.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExpiringMessage({ expiresAt, children, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isDissolving, setIsDissolving] = useState(false);

  const expiryTime = useMemo(
    () => (expiresAt ? new Date(expiresAt).getTime() : null),
    [expiresAt],
  );

  useEffect(() => {
    if (!expiryTime) {
      setTimeLeft(null);
      setIsDissolving(false);
      return;
    }

    const checkExpiry = () => {
      const now = Date.now();
      const remaining = expiryTime - now;

      if (remaining <= 0) {
        setIsVisible(false);
        if (onExpired) onExpired();
        return;
      }

      setTimeLeft(remaining);

      // Trigger dissolve scan-line in the final 4 seconds
      if (remaining <= 4000 && !isDissolving) {
        setIsDissolving(true);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 100);

    return () => clearInterval(interval);
  }, [expiryTime, isDissolving, onExpired]);

  // Total duration approximation for progress bar (~20s default)
  const totalWindow = 20000;
  const progressPercent = timeLeft
    ? Math.min(100, Math.max(0, (timeLeft / totalWindow) * 100))
    : 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{
            opacity: isDissolving ? [1, 0.7, 0.4, 0] : 1,
            scale: isDissolving ? [1, 1.02, 0.96, 0.85] : 1,
            filter: isDissolving ? 'blur(3px)' : 'blur(0px)',
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.7,
            filter: 'blur(8px)',
            transition: { duration: 0.4, ease: 'easeOut' },
          }}
          transition={{
            duration: isDissolving ? 4 : 0.25,
            ease: 'easeInOut',
          }}
          style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}
        >
          {children}

          {/* Countdown timer progress line */}
          {expiresAt && timeLeft !== null && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                borderRadius: '0 0 14px 14px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: isDissolving
                    ? 'var(--color-error, #f87171)'
                    : 'var(--accent-primary, #a78bfa)',
                  transition: 'width 0.1s linear, background 0.3s ease',
                  boxShadow: isDissolving ? '0 0 8px #f87171' : 'none',
                }}
              />
            </div>
          )}

          {/* Scan-line sweep laser effect */}
          {isDissolving && (
            <motion.div
              initial={{ top: '-10%', opacity: 0.8 }}
              animate={{ top: '110%', opacity: [0.8, 1, 0.4] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #f87171, #a78bfa, transparent)',
                boxShadow: '0 0 12px #f87171',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
