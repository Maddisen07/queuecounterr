import React from 'react';
import { formatWaitTime } from '../hooks.js';

export function TicketCard({
  tokenData,
  onCancel,
  onReset,
  loadingAction
}) {
  if (!tokenData || !tokenData.token) return null;

  const { token, position, estimatedWaitSec } = tokenData;
  const isWaiting = token.status === 'waiting';
  const isServing = token.status === 'serving';
  const isCompleted = token.status === 'completed';
  const isCancelled = token.status === 'cancelled';
  const isNoShow = token.status === 'no_show';

  // Ahead of you count
  const aheadOfYou = typeof position === 'number' && position > 0 ? position - 1 : 0;

  // Counter name when serving
  const counterName = token.counter?.name || 'Counter';

  return (
    <div className="ticket-wrapper" aria-live="polite">
      <div className="ticket-card">
        {/* Ticket Top Half */}
        <div className="ticket-top">
          <div className="ticket-header-pill">Queue Ticket • {token.day}</div>
          <div className="ticket-label" aria-label={`Token number ${token.label}`}>
            {token.label}
          </div>

          {token.customerName && (
            <div className="ticket-customer">{token.customerName}</div>
          )}

          {token.note && <div className="ticket-note">"{token.note}"</div>}
        </div>

        {/* Perforated Divider with Side Notches */}
        <div className="ticket-divider-zone" aria-hidden="true">
          <div className="ticket-notch ticket-notch-left"></div>
          <div className="ticket-dashed-line"></div>
          <div className="ticket-notch ticket-notch-right"></div>
        </div>

        {/* Ticket Bottom Half */}
        <div className="ticket-bottom">
          {/* Status Badge */}
          <div className={`ticket-status-pill status-${token.status}`}>
            {isWaiting && '⏳ In Queue'}
            {isServing && '📢 Now Serving'}
            {isCompleted && '✔ Completed'}
            {isCancelled && '✖ Cancelled'}
            {isNoShow && '⚠️ Missed Call'}
          </div>

          {/* Serving State Banner */}
          {isServing && (
            <div className="serving-callout">
              <div className="serving-callout-title">Please Proceed To</div>
              <div className="serving-callout-counter">{counterName}</div>
            </div>
          )}

          {/* Waiting Metrics */}
          {isWaiting && (
            <div className="ticket-metrics">
              <div className="ticket-metric-item">
                <span className="metric-num">
                  {aheadOfYou === 0 ? 'You are next!' : aheadOfYou}
                </span>
                <span className="metric-text">
                  {aheadOfYou === 0 ? 'Queue Position #1' : 'Ahead of You'}
                </span>
              </div>
              <div className="ticket-metric-item">
                <span className="metric-num">
                  {estimatedWaitSec !== null
                    ? formatWaitTime(estimatedWaitSec)
                    : 'Paused'}
                </span>
                <span className="metric-text">
                  {estimatedWaitSec !== null
                    ? 'Estimated Wait'
                    : 'No Open Counters'}
                </span>
              </div>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div style={{ textAlign: 'center', color: 'var(--gray-700)', padding: '0.5rem 0' }}>
              <strong>Service finished!</strong>
              {token.serviceDurationSec !== null && (
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                  Duration: {formatWaitTime(token.serviceDurationSec, { precise: true })}
                </div>
              )}
            </div>
          )}

          {/* Cancelled State */}
          {isCancelled && (
            <div style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '0.5rem 0' }}>
              You left the queue.
            </div>
          )}

          {/* No Show State */}
          {isNoShow && (
            <div style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '0.5rem 0' }}>
              You were called but were unavailable.
            </div>
          )}

          {/* Actions */}
          <div className="ticket-actions">
            {isWaiting && (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={onCancel}
                disabled={loadingAction}
              >
                {loadingAction ? 'Leaving...' : 'Leave Queue'}
              </button>
            )}

            {(isCompleted || isCancelled || isNoShow) && (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onReset}
              >
                Get a New Token
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
