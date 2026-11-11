import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api.js';
import { useLocalStorage, usePolling, formatWaitTime } from '../hooks.js';
import { TicketCard } from './TicketCard.jsx';
import { Alert } from './Alert.jsx';

const REASON_PRESETS = [
  'General Inquiry',
  'Document Pickup',
  'Consultation',
  'Payment / Billing',
  'Account Support'
];

export function JoinScreen() {
  const [savedTokenId, setSavedTokenId] = useLocalStorage('queuecounter_token_id', null);
  const [tokenData, setTokenData] = useState(null);
  const [queueSummary, setQueueSummary] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  // Poll current token status if we have a saved tokenId
  const fetchTokenStatus = useCallback(async () => {
    if (!savedTokenId) {
      setTokenData(null);
      return;
    }
    try {
      const data = await api.getToken(savedTokenId);
      setTokenData(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Clear from localStorage if server returns 404 as requested
        setSavedTokenId(null);
        setTokenData(null);
      } else {
        setError(err.message);
      }
    }
  }, [savedTokenId, setSavedTokenId]);

  // Poll general queue summary (waiting count & arrival wait)
  const fetchQueueSummary = useCallback(async () => {
    try {
      const data = await api.getQueue();
      setQueueSummary({
        waitingCount: data.waiting?.length || 0,
        estimatedArrivalWaitSec: data.estimatedWaitSecForNewArrival,
        openCounterCount: data.openCounterCount
      });
    } catch {
      // Background poll failure is silent
    }
  }, []);

  // Poll every 3.5s
  usePolling(fetchTokenStatus, 3500, !!savedTokenId);
  usePolling(fetchQueueSummary, 3500, true);

  useEffect(() => {
    fetchQueueSummary();
    if (savedTokenId) {
      fetchTokenStatus();
    }
  }, [fetchQueueSummary, fetchTokenStatus, savedTokenId]);

  // Handle Form Submit to Join Queue
  const handleJoin = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = customerName.trim();
    const trimmedNote = note.trim();

    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }

    if (!trimmedNote) {
      setError('Please provide or select a service reason.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await api.joinQueue({
        customerName: trimmedName,
        note: trimmedNote
      });
      setSavedTokenId(result.token._id);
      setTokenData(result);
      setCustomerName('');
      setNote('');
    } catch (err) {
      setError(err.message || 'Failed to join the queue');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Leaving Queue
  const handleCancel = async () => {
    if (!savedTokenId) return;
    setError(null);
    setCancelling(true);

    try {
      const updated = await api.cancelToken(savedTokenId);
      setTokenData((prev) => ({
        ...prev,
        token: updated.token || updated,
        position: null,
        estimatedWaitSec: null
      }));
    } catch (err) {
      setError(err.message || 'Failed to leave the queue');
    } finally {
      setCancelling(false);
    }
  };

  // Reset to form
  const handleReset = () => {
    setSavedTokenId(null);
    setTokenData(null);
    setError(null);
  };

  return (
    <div className="join-screen">
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* If customer has an active token, render Ticket Card */}
      {savedTokenId && tokenData ? (
        <TicketCard
          tokenData={tokenData}
          onCancel={handleCancel}
          onReset={handleReset}
          loadingAction={cancelling}
        />
      ) : (
        /* Otherwise render live queue banner + intake form */
        <div>
          {/* Live Metric Cards Banner */}
          {queueSummary && (
            <div className="queue-summary-banner">
              <div className="summary-stat-card card-accent-yellow">
                <div className="stat-header">
                  <span className="stat-title">In Line Now</span>
                  <span className="stat-icon" aria-hidden="true">👥</span>
                </div>
                <div className="stat-value num-tabular">{queueSummary.waitingCount}</div>
                <div className="stat-subtext">Customers waiting</div>
              </div>

              <div className="summary-stat-card card-accent-teal">
                <div className="stat-header">
                  <span className="stat-title">Open Counters</span>
                  <span className="stat-icon" aria-hidden="true">🏢</span>
                </div>
                <div className="stat-value num-tabular">{queueSummary.openCounterCount}</div>
                <div className="stat-subtext">Active service desks</div>
              </div>

              <div className="summary-stat-card card-accent-navy">
                <div className="stat-header">
                  <span className="stat-title">Est. Wait if Joining</span>
                  <span className="stat-icon" aria-hidden="true">⏱️</span>
                </div>
                <div className="stat-value" style={{ fontSize: '2.2rem' }}>
                  {queueSummary.openCounterCount === 0
                    ? 'Closed'
                    : formatWaitTime(queueSummary.estimatedArrivalWaitSec)}
                </div>
                <div className="stat-subtext">
                  {queueSummary.openCounterCount === 0
                    ? 'Counters paused'
                    : 'Approximate wait time'}
                </div>
              </div>
            </div>
          )}

          {/* Customer Intake Form Card */}
          <div className="form-card">
            <h1 className="form-title">Take a Ticket</h1>
            <p className="form-subtitle">
              Take your walk-in token. Watch your phone or the waiting-room display board for your number.
            </p>

            <form onSubmit={handleJoin} noValidate>
              <div className="form-group">
                <label htmlFor="customerName" className="form-label">
                  <span>
                    Your Name <span style={{ color: 'var(--error-red)' }}>*</span>
                  </span>
                  <span className="form-char-count">{customerName.length}/60</span>
                </label>
                <input
                  id="customerName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jordan Smith"
                  value={customerName}
                  maxLength={60}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={submitting}
                  autoComplete="name"
                  required
                />
              </div>

              {/* Quick Reason Chips */}
              <div>
                <span className="quick-reasons-label">
                  Quick Select Reason <span style={{ color: 'var(--error-red)' }}>*</span>:
                </span>
                <div className="quick-reasons-chips">
                  {REASON_PRESETS.map((preset) => {
                    const isSelected = note === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`chip-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setNote(isSelected ? '' : preset)}
                        disabled={submitting}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="note" className="form-label">
                  <span>
                    Service Reason <span style={{ color: 'var(--error-red)' }}>*</span>
                  </span>
                  <span className="form-char-count">{note.length}/120</span>
                </label>
                <textarea
                  id="note"
                  rows={2}
                  className="form-textarea"
                  placeholder="e.g. Need help with address change or license renewal"
                  value={note}
                  maxLength={120}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '0.75rem' }}
                disabled={submitting || !customerName.trim() || !note.trim()}
              >
                {submitting ? 'Printing Ticket...' : '🎟️ Take Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
