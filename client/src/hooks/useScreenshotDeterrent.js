/**
 * hooks/useScreenshotDeterrent.js — Best-effort screenshot prevention
 *
 * ⚠️  IMPORTANT DISCLAIMER (mention in viva):
 * This is NOT real DRM. Browsers cannot reliably block OS-level screenshots.
 * These are "deterrents" only — they make casual screenshots harder but
 * cannot prevent a determined user from capturing the screen.
 *
 * WHAT WE DO:
 * 1. Blur chat content when the browser tab loses focus (visibilitychange)
 * 2. Detect known screenshot keyboard shortcuts and show a warning
 * 3. Disable right-click context menu on chat area
 */

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useScreenshotDeterrent() {
  const [isBlurred, setIsBlurred] = useState(false);

  // ─── 1. Blur on tab switch / window focus loss ────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        // Small delay before un-blurring to catch Alt+Tab screenshot attempts
        setTimeout(() => setIsBlurred(false), 300);
      }
    };

    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setTimeout(() => setIsBlurred(false), 300);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // ─── 2. Detect screenshot keyboard shortcuts ─────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        toast.error('📸 Screenshots are discouraged in MiniChat', {
          icon: '🔒',
        });
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 2000);
      }

      // Cmd+Shift+3 or Cmd+Shift+4 (macOS)
      if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4')) {
        toast.error('📸 Screenshots are discouraged in MiniChat', {
          icon: '🔒',
        });
      }

      // Windows Snipping Tool (Win+Shift+S)
      if (e.metaKey && e.shiftKey && e.key === 'S') {
        toast.error('📸 Screenshots are discouraged in MiniChat', {
          icon: '🔒',
        });
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 2000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── 3. Disable right-click (minor deterrent) ────────────────
  const preventContextMenu = useCallback((e) => {
    e.preventDefault();
    toast('Right-click disabled for privacy', {
      icon: '🔒',
      duration: 2000,
    });
  }, []);

  return { isBlurred, preventContextMenu };
}
