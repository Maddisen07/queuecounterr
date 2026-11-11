import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../api.js';
import { useLocalStorage, usePolling, formatWaitTime } from '../hooks.js';
import { TicketCard } from './TicketCard.jsx';
import { Alert } from './Alert.jsx';

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
        // As requested: clear from localStorage if server returns 404
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
    } catch (err) {
      // Don't show critical error for background snapshot polling
    }
  }, []);

  // Poll every 3.5s
  usePolling(fetchTokenStatus, 3500, !!savedTokenId);
  usePolling(fetchQueueSummary, 4000, true);

  // Initial load
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
    setSubmitting(true);

    try {
      const result = await api.joinQueue({
        customerName: customerName.trim(),
        note: note.trim()
      });
      // Store token ID in localStorage
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

  // Handle Leaving the Queue
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

  // Reset to intake form (for completed, cancelled, or no-show tokens)
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

      {/* If the customer has an active or recent token, show Ticket Card */}
      {savedTokenId && tokenData ? (
        <div>
          <TicketCard
            tokenData={tokenData}
            onCancel={handleCancel}
            onReset={handleReset}
            loadingAction={cancelling}
          />
        </div>
      ) : (
        /* Otherwise, show Queue Summary & Intake Form */
        <div>
          {/* Queue Snapshot Indicator */}
          {queueSummary && (
            <div className="queue-summary-banner">
              <div className="summary-stat">
                <span className="stat-label">Currently Waiting</span>
                <span className="stat-value">{queueSummary.waitingCount}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Open Counters</span>
                <span className="stat-value">{queueSummary.openCounterCount}</span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Est. Wait if Joining Now</span>
                <span className="stat-value">
                  {queueSummary.openCounterCount === 0
                    ? 'Counters Closed'
                    : formatWaitTime(queueSummary.estimatedArrivalWaitSec)}
                </span>
              </div>
            </div>
          )}

          <div className="form-card">
            <h1 className="form-title">Take a Token</h1>
            <p className="form-subtitle">
              Join the walk-in queue. We will notify you when a counter calls your number.
            </p>

            <form onSubmit={handleJoin} noValidate>
              <div className="form-group">
                <label htmlFor="customerName" className="form-label">
                  <span>Your Name (optional)</span>
                  <span className="form-char-count">{customerName.length}/60</span>
                </label>
                <input
                  id="customerName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alex"
                  value={customerName}
                  maxLength={60}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="note" className="form-label">
                  <span>Service Reason / Note (optional)</span>
                  <span className="form-char-count">{note.length}/120</span>
                </label>
                <textarea
                  id="note"
                  rows={2}
                  className="form-textarea"
                  placeholder="e.g. Account query or document pickup"
                  value={note}
                  maxLength={120}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={submitting}
              >
                {submitting ? 'Generating Token...' : 'Get Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
