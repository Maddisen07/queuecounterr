import React, { useEffect, useRef } from 'react';
import { formatWaitTime } from '../hooks.js';
import { playChime } from '../utils/sound.js';

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

  // Play audio chime if status just changed to 'serving'
  const prevStatusRef = useRef(token.status);
  useEffect(() => {
    if (prevStatusRef.current !== 'serving' && token.status === 'serving') {
      try {
        if (localStorage.getItem('queuecounter_sound') !== 'false') {
          playChime();
        }
      } catch {}
    }
    prevStatusRef.current = token.status;
  }, [token.status]);

  const aheadOfYou = typeof position === 'number' && position > 0 ? position - 1 : 0;
  const counterName = token.counter?.name || 'Counter';

  // Stepper state calculation
  const getStepState = () => {
    if (isWaiting) return 1; // Waiting
    if (isServing) return 2; // Serving
    if (isCompleted || isCancelled || isNoShow) return 3; // Done
    return 0;
  };
  const stepIndex = getStepState();

  return (
    <div className="ticket-wrapper" aria-live="polite">
      <div className="ticket-container">
        {/* Ticket Top Half */}
        <div className="ticket-top">
          <div className="ticket-agency-badge">
            <span>Official Queue Ticket</span>
            <span>•</span>
            <span>{token.day}</span>
          </div>

          <div
            className="ticket-giant-label num-tabular"
            aria-label={`Token number ${token.label}`}
          >
            {token.label}
          </div>

          {token.customerName && (
            <div className="ticket-customer-badge">
              <span>👤</span>
              <span>{token.customerName}</span>
            </div>
          )}

          {token.note && (
            <div className="ticket-note-quote">
              "{token.note}"
            </div>
          )}
        </div>

        {/* Signature Perforated Tear Line with Semicircular Notches */}
        <div className="ticket-divider-container" aria-hidden="true">
          <div className="ticket-notch-circle notch-left"></div>
          <div className="ticket-perforated-line"></div>
          <div className="ticket-notch-circle notch-right"></div>
        </div>

        {/* Ticket Bottom Half */}
        <div className="ticket-bottom">
          {/* Visual Step Stepper */}
          <div className="ticket-step-progress" aria-hidden="true">
            <div className="step-progress-track">
              <div
                className="step-progress-fill"
                style={{ width: `${(stepIndex / 3) * 100}%` }}
              ></div>
            </div>

            <div className={`step-node ${stepIndex >= 0 ? (stepIndex === 0 ? 'is-active' : 'is-passed') : ''}`}>
              <div className="step-circle">1</div>
              <span className="step-title">Taken</span>
            </div>
            <div className={`step-node ${stepIndex >= 1 ? (stepIndex === 1 ? 'is-active' : 'is-passed') : ''}`}>
              <div className="step-circle">2</div>
              <span className="step-title">Waiting</span>
            </div>
            <div className={`step-node ${stepIndex >= 2 ? (stepIndex === 2 ? 'is-active' : 'is-passed') : ''}`}>
              <div className="step-circle">3</div>
              <span className="step-title">Serving</span>
            </div>
            <div className={`step-node ${stepIndex >= 3 ? 'is-active' : ''}`}>
              <div className="step-circle">4</div>
              <span className="step-title">Done</span>
            </div>
          </div>

          {/* Rubber Stamp Status Badge */}
          <div className={`stamp-badge stamp-${token.status}`}>
            {isWaiting && '⏳ WAITING IN LINE'}
            {isServing && '📢 NOW SERVING'}
            {isCompleted && '✔ SERVICE COMPLETE'}
            {isCancelled && '✖ TICKET CANCELLED'}
            {isNoShow && '⚠️ MISSED CALL'}
          </div>

          {/* High-Impact Serving Alert Box */}
          {isServing && (
            <div className="ticket-serving-hero">
              <div className="serving-hero-eyebrow">Please Proceed Directly To</div>
              <div className="serving-hero-counter">{counterName}</div>
              <p className="serving-hero-tip">A staff member is ready to assist you right now.</p>
            </div>
          )}

          {/* Waiting Metrics Grid */}
          {isWaiting && (
            <div className="ticket-metrics-grid">
              <div className="metric-card-inner">
                <span className="metric-big-num num-tabular">
                  {aheadOfYou === 0 ? 'Next!' : aheadOfYou}
                </span>
                <span className="metric-sub-label">
                  {aheadOfYou === 0 ? 'Position #1' : 'Ahead of You'}
                </span>
              </div>
              <div className="metric-card-inner">
                <span className="metric-big-num num-tabular">
                  {estimatedWaitSec !== null
                    ? formatWaitTime(estimatedWaitSec)
                    : 'Paused'}
                </span>
                <span className="metric-sub-label">
                  {estimatedWaitSec !== null
                    ? 'Estimated Wait'
                    : 'No Open Counters'}
                </span>
              </div>
            </div>
          )}

          {/* Completed State Summary */}
          {isCompleted && (
            <div style={{ textAlign: 'center', padding: '0.25rem 0', color: 'var(--gray-700)' }}>
              <strong>Thank you for your visit!</strong>
              {token.serviceDurationSec !== null && (
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                  Total service time: {formatWaitTime(token.serviceDurationSec, { precise: true })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {isWaiting && (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={onCancel}
                disabled={loadingAction}
              >
                {loadingAction ? 'Cancelling...' : 'Leave Queue'}
              </button>
            )}

            {(isCompleted || isCancelled || isNoShow) && (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onReset}
              >
                + Get Another Ticket
              </button>
            )}
          </div>

          {/* Barcode & Serial Footer */}
          <div className="ticket-barcode-zone" aria-hidden="true">
            <div className="barcode-strip"></div>
            <div className="barcode-text">ID: {String(token._id).slice(-8).toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
