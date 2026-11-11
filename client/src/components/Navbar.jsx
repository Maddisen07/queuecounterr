import React from 'react';

export function Navbar({ currentHash, onNavigate }) {
  const navItems = [
    { hash: '#/join', label: 'Take Token', icon: '🎫' },
    { hash: '#/staff', label: 'Counters & Staff', icon: '🖥️' },
    { hash: '#/board', label: 'Display Board', icon: '📢' }
  ];

  return (
    <header className="navbar">
      <div className="nav-brand">
        <span>QueueCounter</span>
        <span className="brand-badge">WALK-IN QUEUE</span>
      </div>
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
    </header>
  );
}
