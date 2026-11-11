import React, { useState, useEffect } from 'react';
import { playChime } from '../utils/sound.js';

export function Navbar({ currentHash, onNavigate }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('queuecounter_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    try {
      localStorage.setItem('queuecounter_sound', String(nextVal));
    } catch {}
    if (nextVal) {
      playChime();
    }
  };

  const navItems = [
    { hash: '#/join', label: 'Take Token', icon: '🎫' },
    { hash: '#/staff', label: 'Staff & Counters', icon: '🖥️' },
    { hash: '#/board', label: 'Display Board', icon: '📢' }
  ];

  return (
    <header className="navbar">
      <div className="nav-brand-group">
        <a
          href="#/join"
          className="nav-brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('#/join');
          }}
        >
          <div className="brand-icon">Q</div>
          <span>QueueCounter</span>
        </a>
        <span className="brand-tag">Walk-in Queue</span>

        <div className="live-status-pill" title="Real-time background polling active">
          <span className="live-pulse-dot" aria-hidden="true"></span>
          <span>Live</span>
        </div>
      </div>

      <div className="nav-actions">
        <nav aria-label="Main Navigation">
          <ul className="nav-links">
            {navItems.map((item) => {
              const isActive = currentHash === item.hash;
              return (
                <li key={item.hash}>
                  <a
                    href={item.hash}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.hash);
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className={`sound-toggle-btn ${soundEnabled ? 'sound-active' : ''}`}
          onClick={toggleSound}
          title={soundEnabled ? 'Chime sound enabled (click to mute)' : 'Chime sound muted (click to unmute)'}
          aria-label={soundEnabled ? 'Mute announcement chime' : 'Enable announcement chime'}
        >
          {soundEnabled ? '🔔' : '🔕'}
        </button>
      </div>
    </header>
  );
}
