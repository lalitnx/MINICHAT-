/**
 * components/Common/ThemeToggle.jsx — Reusable Light / Dark Theme Switcher
 */

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle({ style = {} }) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      style={{
        background: 'var(--bg-elevated, #1a1a2e)',
        border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
        color: 'var(--text-primary, #e4e4ef)',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.1rem',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.15))',
        transition: 'all 0.2s ease',
        ...style,
      }}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.borderColor = 'var(--accent-primary, #a78bfa)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = 'var(--border-default, rgba(255, 255, 255, 0.12))';
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
