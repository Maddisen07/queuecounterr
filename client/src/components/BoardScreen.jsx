import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.js';
import { usePolling, formatWaitTime } from '../hooks.js';
import { playChime } from '../utils/sound.js';
import { Alert } from './Alert.jsx';

export function BoardScreen() {
  const [queueData, setQueueData] = useState(null);
  const [error, setError] = useState(null);

  // Digital clock
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Track serving tokens to trigger chime when a new token is called
  const prevTokensRef = useRef(new Set());

  const fetchQueue = useCallback(async () => {
    try {
      const data = await api.getQueue();
      setQueueData(data);
      setError(null);

      // Check if any new token is being served
      const currentServingTokens = new Set();
      for (const counter of data.counters || []) {
        if (counter.isActive && counter.currentToken?.label) {
          currentServingTokens.add(counter.currentToken.label);
        }
      }

      // If a token was newly added to serving set, chime!
      let hasNewCall = false;
      for (const label of currentServingTokens) {
        if (!prevTokensRef.current.has(label)) {
          hasNewCall = true;
          break;
        }
      }

      if (hasNewCall && prevTokensRef.current.size > 0) {
        try {
          if (localStorage.getItem('queuecounter_sound') !== 'false') {
            playChime();
          }
        } catch {}
      }

      prevTokensRef.current = currentServingTokens;
    } catch (err) {
      setError(err.message || 'Connecting to display service...');
    }
  }, []);

  // Poll every 3 seconds for fast board responsiveness
  usePolling(fetchQueue, 3000, true);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const openCounters = (queueData?.counters || []).filter((c) => c.isActive);
  const waitingList = queueData?.waiting || [];
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

      {/* Terminal Style Header Banner with Live Clock */}
      <div className="board-header-banner">
        <div>
          <div className="board-clock-strip">
            <span className="board-digital-clock num-tabular">{currentTime}</span>
          </div>
          <p style={{ color: 'var(--gray-400)', fontSize: '1.1rem', marginTop: '0.25rem' }}>
            {openCounters.length === 0
              ? 'All service counters are currently closed'
              : `${openCounters.length} Counter${openCounters.length > 1 ? 's' : ''} Open • ${waitingList.length} Customer${waitingList.length === 1 ? '' : 's'} in Line`}
          </p>
        </div>

        <div className="board-wait-banner-box">
          <span className="board-wait-title">Estimated Wait If Joining</span>
          <span className="board-wait-digits num-tabular">
            {openCounters.length === 0 ? 'Closed' : formatWaitTime(newArrivalWait)}
          </span>
        </div>
      </div>

      {/* Now Serving Section: Giant readable cards per open counter */}
      <section aria-label="Now Serving Desks">
        {openCounters.length === 0 ? (
          <div
            className="board-counter-cell"
            style={{ padding: '4rem 2rem', borderStyle: 'dashed' }}
          >
            <div className="board-idle-placeholder">ALL COUNTERS CLOSED</div>
            <p style={{ color: 'var(--gray-400)', fontSize: '1.25rem' }}>
              Service counters are closed. Please wait for an attendant.
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
                  className={`board-counter-cell ${
                    isServing ? 'is-actively-serving' : ''
                  }`}
                >
                  <h3 className="board-cell-counter-name">{counter.name}</h3>

                  {isServing ? (
                    <>
                      <div className="board-serving-ribbon">NOW SERVING</div>
                      <div
                        className="board-giant-number num-tabular"
                        aria-label={`Counter ${counter.name} serving token ${currentToken.label}`}
                      >
                        {currentToken.label}
                      </div>
                      {currentToken.customerName && (
                        <div className="board-cell-customer">
                          👤 {currentToken.customerName}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="board-idle-placeholder">READY</div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '1.15rem', fontWeight: 600 }}>
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

      {/* Up Next List: High Contrast Preview Grid */}
      <section className="board-upnext-card" aria-label="Upcoming Tokens">
        <div className="board-upnext-header">
          <h2 className="board-upnext-title">Up Next</h2>
          <span style={{ fontSize: '1.1rem', color: 'var(--gray-400)', fontWeight: 700 }}>
            {waitingList.length > 8
              ? `Showing Next 8 of ${waitingList.length} in Line`
              : `${waitingList.length} Waiting`}
          </span>
        </div>

        {upNextTokens.length === 0 ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '1.25rem', fontStyle: 'italic', padding: '1rem 0' }}>
            No tokens currently waiting in queue.
          </div>
        ) : (
          <div className="board-upnext-grid">
            {upNextTokens.map((token, index) => (
              <div key={token._id} className="board-upnext-cell">
                <div className="upnext-top-row">
                  <span className="upnext-token-digits num-tabular">{token.label}</span>
                  <span className="upnext-pos-tag">#{index + 1}</span>
                </div>
                {token.customerName ? (
                  <div className="upnext-name-text" title={token.customerName}>
                    👤 {token.customerName}
                  </div>
                ) : (
                  <div className="upnext-name-text" style={{ opacity: 0.5 }}>
                    Walk-in
                  </div>
                )}
                <div className="upnext-wait-tag">
                  <span>⏱️ Est. Wait:</span>
                  <strong style={{ color: 'var(--ticket-yellow)' }}>
                    {formatWaitTime(token.estimatedWaitSec)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
