import React from 'react';

export function Alert({ type = 'error', message, onClose, details }) {
  if (!message) return null;

  return (
    <div
      className={`alert-banner alert-${type}`}
      role="alert"
      aria-live="assertive"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span>{message}</span>
        {details && (
          <small style={{ opacity: 0.85 }}>
            {Array.isArray(details) ? details.join(', ') : String(details)}
          </small>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          className="alert-close"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          &times;
        </button>
      )}
    </div>
  );
}
