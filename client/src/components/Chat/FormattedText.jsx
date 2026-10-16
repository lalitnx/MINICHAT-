import React from 'react';

/**
 * FormattedText — Lightweight, safe markdown formatter for chat bubbles
 * Handles: bold, inline code, headings, lists, links, line breaks
 */
export default function FormattedText({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div style={{ lineHeight: '1.55', wordBreak: 'break-word' }}>
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} style={{ height: '0.4rem' }} />;
        }

        // Headings
        if (line.startsWith('### ')) {
          return (
            <h4
              key={idx}
              style={{
                margin: '0.4rem 0 0.2rem',
                fontWeight: 700,
                fontSize: '0.98rem',
                color: 'var(--accent-primary, #a78bfa)',
              }}
            >
              {renderInline(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3
              key={idx}
              style={{
                margin: '0.5rem 0 0.25rem',
                fontWeight: 700,
                fontSize: '1.05rem',
                color: 'var(--accent-primary, #a78bfa)',
              }}
            >
              {renderInline(line.slice(3))}
            </h3>
          );
        }

        // Bullet lists
        if (/^[-*•]\s+/.test(line)) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '0.45rem',
                margin: '0.2rem 0',
                paddingLeft: '0.3rem',
              }}
            >
              <span style={{ color: 'var(--accent-primary, #a78bfa)' }}>•</span>
              <span style={{ flex: 1 }}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '0.45rem',
                margin: '0.2rem 0',
                paddingLeft: '0.3rem',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--accent-primary, #a78bfa)' }}>
                {numMatch[1]}.
              </span>
              <span style={{ flex: 1 }}>{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <div key={idx} style={{ margin: '0.15rem 0' }}>
            {renderInline(line)}
          </div>
        );
      })}
    </div>
  );
}

function renderInline(str) {
  const parts = [];
  let key = 0;

  // Match bold **text**, inline `code`, and markdown links [text](url)
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} style={{ fontWeight: 700, color: '#f3f4f6' }}>
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '0.88em',
            fontFamily: 'monospace',
            color: '#38bdf8',
          }}
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2] && match[3]) {
      parts.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#38bdf8', textDecoration: 'underline' }}
        >
          {match[2]} ↗
        </a>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}
