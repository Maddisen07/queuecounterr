import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { usePolling, formatWaitTime } from '../hooks.js';
import { Alert } from './Alert.jsx';

export function BoardScreen() {
  const [queueData, setQueueData] = useState(null);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await api.getQueue();
      setQueueData(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Connecting to display service...');
    }
  }, []);

  // Poll every 3 seconds for fast board response
  usePolling(fetchQueue, 3000, true);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const openCounters = (queueData?.counters || []).filter((c) => c.isActive);
  const waitingList = queueData?.waiting || [];
  // Next 8 tokens for Up Next list
  const upNextTokens = waitingList.slice(0, 8);

  const newArrivalWait = queueData?.estimatedWaitSecForNewArrival;

  return (
    <div className="board-container">
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Top Banner: Estimated Wait for New Arrivals & Queue Status */}
      <div className="board-arrival-banner">
        <div className="board-banner-text">
          <h2>Service Status Board</h2>
          <p>
            {openCounters.length === 0
              ? 'All service counters are currently closed'
              : `${openCounters.length} Counter${openCounters.length > 1 ? 's' : ''} Open • ${waitingList.length} In Line`}
          </p>
        </div>

        <div className="board-banner-metric">
          <span className="board-wait-subtitle">Estimated Wait For New Arrivals</span>
          <span className="board-wait-time-huge">
            {openCounters.length === 0
              ? 'Closed'
              : formatWaitTime(newArrivalWait)}
          </span>
        </div>
      </div>

      {/* Now Serving Section: Giant readable cards per open counter */}
      <section aria-label="Now Serving Counters">
        {openCounters.length === 0 ? (
          <div
            className="board-counter-card idle-counter"
            style={{ padding: '3rem', margin: '1rem 0' }}
          >
            <div className="board-idle-text">COUNTERS CURRENTLY CLOSED</div>
            <p style={{ color: 'var(--gray-500)', fontSize: '1.25rem' }}>
              Please check back shortly or speak with a staff member.
            </p>
          </div>
        ) : (
          <div className="board-serving-grid">
            {openCounters.map((counter) => {
              const currentToken = counter.currentToken;
              const isServing = !!currentToken;

              return (
                <div
                  key={counter._id}
                  className={`board-counter-card ${
                    isServing ? 'active-serving' : 'idle-counter'
                  }`}
                >
                  <h3 className="board-counter-title">{counter.name}</h3>

                  {isServing ? (
                    <>
                      <div className="board-now-serving-badge">NOW SERVING</div>
                      <div
                        className="board-token-giant"
                        aria-label={`Counter ${counter.name} serving token ${currentToken.label}`}
                      >
                        {currentToken.label}
                      </div>
                      {currentToken.customerName && (
                        <div className="board-customer-name">
                          {currentToken.customerName}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="board-idle-text">READY</div>
                      <div style={{ color: 'var(--gray-400)', fontSize: '1.1rem', fontWeight: 600 }}>
                        Next customer will be called shortly
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Up Next List: Next up to 8 tokens */}
      <section className="board-up-next-section" aria-label="Upcoming Tokens">
        <div className="up-next-title">
          <span>Up Next</span>
          <span style={{ fontSize: '1.1rem', color: 'var(--gray-500)', fontWeight: 600 }}>
            {waitingList.length > 8 ? `Showing next 8 of ${waitingList.length}` : `${waitingList.length} Waiting`}
          </span>
        </div>

        {upNextTokens.length === 0 ? (
          <div style={{ color: 'var(--gray-400)', fontSize: '1.2rem', fontStyle: 'italic', padding: '1rem 0' }}>
            No tokens waiting in queue.
          </div>
        ) : (
          <div className="up-next-grid">
            {upNextTokens.map((token, index) => (
              <div key={token._id} className="up-next-token-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="up-next-token-label">{token.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                    #{index + 1}
                  </span>
                </div>
                {token.customerName && (
                  <div className="up-next-name" title={token.customerName}>
                    {token.customerName}
                  </div>
                )}
                <div className="up-next-wait">
                  Est. Wait: {formatWaitTime(token.estimatedWaitSec)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
