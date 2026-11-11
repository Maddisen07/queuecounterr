import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { usePolling, formatWaitTime, formatElapsedTime } from '../hooks.js';
import { playChime } from '../utils/sound.js';
import { Alert } from './Alert.jsx';

export function StaffScreen() {
  const [queueData, setQueueData] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // New counter input
  const [newCounterName, setNewCounterName] = useState('');
  const [addingCounter, setAddingCounter] = useState(false);

  // Editing counter
  const [editingCounterId, setEditingCounterId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Waiting list search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Live seconds ticker for serving timers
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicker((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch full queue snapshot
  const fetchQueue = useCallback(async () => {
    try {
      const data = await api.getQueue();
      setQueueData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch queue data');
    }
  }, []);

  usePolling(fetchQueue, 3500, true);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };

  // Action: Call Next Customer
  const handleCallNext = async (counterId, counterName) => {
    clearMessages();
    setLoadingAction(true);
    try {
      const result = await api.callNext(counterId);
      setSuccessMsg(`Called ${result.token?.label} to ${counterName}`);
      try {
        if (localStorage.getItem('queuecounter_sound') !== 'false') {
          playChime();
        }
      } catch {}
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: Mark Complete
  const handleComplete = async (counterId, counterName) => {
    clearMessages();
    setLoadingAction(true);
    try {
      const result = await api.completeService(counterId);
      setSuccessMsg(
        `Service completed for ${result.token?.label} at ${counterName} (${formatWaitTime(result.token?.serviceDurationSec, { precise: true })})`
      );
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: No-Show
  const handleNoShow = async (counterId, counterName) => {
    clearMessages();
    setLoadingAction(true);
    try {
      const result = await api.noShow(counterId);
      setSuccessMsg(`Marked ${result.token?.label} at ${counterName} as no-show`);
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: Toggle Open / Close
  const handleToggleActive = async (counter) => {
    clearMessages();
    setLoadingAction(true);
    try {
      await api.updateCounter(counter._id, { isActive: !counter.isActive });
      setSuccessMsg(`${counter.name} is now ${!counter.isActive ? 'Open' : 'Closed'}`);
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: Rename Counter
  const handleRenameCounter = async (counterId) => {
    if (!editingName.trim()) return;
    clearMessages();
    setLoadingAction(true);
    try {
      await api.updateCounter(counterId, { name: editingName.trim() });
      setSuccessMsg('Counter renamed successfully');
      setEditingCounterId(null);
      setEditingName('');
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: Delete Counter
  const handleDeleteCounter = async (counter) => {
    if (!window.confirm(`Are you sure you want to delete ${counter.name}?`)) {
      return;
    }
    clearMessages();
    setLoadingAction(true);
    try {
      await api.deleteCounter(counter._id);
      setSuccessMsg(`${counter.name} deleted`);
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAction(false);
    }
  };

  // Action: Add Counter
  const handleAddCounter = async (e) => {
    e.preventDefault();
    if (!newCounterName.trim()) return;
    clearMessages();
    setAddingCounter(true);
    try {
      const result = await api.createCounter(newCounterName.trim());
      setSuccessMsg(`Created ${result.counter?.name}`);
      setNewCounterName('');
      await fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingCounter(false);
    }
  };

  const counters = queueData?.counters || [];
  const waitingList = queueData?.waiting || [];
  const openCounters = counters.filter((c) => c.isActive);
  const avgDuration = queueData?.averageServiceTimeSec || 300;

  // Filter waiting list by search term
  const filteredWaiting = waitingList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="staff-container">
      {/* Alert Notices */}
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
      {successMsg && (
        <Alert
          type="success"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}

      {/* Upgraded Stats Metric Cards */}
      <div className="queue-summary-banner">
        <div className="summary-stat-card card-accent-yellow">
          <div className="stat-header">
            <span className="stat-title">Waiting In Queue</span>
            <span className="stat-icon" aria-hidden="true">⏳</span>
          </div>
          <div className="stat-value num-tabular">{waitingList.length}</div>
          <div className="stat-subtext">Pending customers</div>
        </div>

        <div className="summary-stat-card card-accent-teal">
          <div className="stat-header">
            <span className="stat-title">Active Desks</span>
            <span className="stat-icon" aria-hidden="true">🏢</span>
          </div>
          <div className="stat-value num-tabular">
            {openCounters.length} <span style={{ fontSize: '1.25rem', color: 'var(--gray-400)' }}>/ {counters.length}</span>
          </div>
          <div className="stat-subtext">Open service counters</div>
        </div>

        <div className="summary-stat-card card-accent-navy">
          <div className="stat-header">
            <span className="stat-title">Avg Service Duration</span>
            <span className="stat-icon" aria-hidden="true">⏱️</span>
          </div>
          <div className="stat-value" style={{ fontSize: '2.4rem' }}>
            {formatWaitTime(avgDuration, { precise: true })}
          </div>
          <div className="stat-subtext">Mean of last 20 completed</div>
        </div>

        <div className="summary-stat-card card-accent-amber">
          <div className="stat-header">
            <span className="stat-title">Arrival Wait Estimate</span>
            <span className="stat-icon" aria-hidden="true">🚀</span>
          </div>
          <div className="stat-value" style={{ fontSize: '2.4rem' }}>
            {openCounters.length === 0
              ? 'Closed'
              : formatWaitTime(queueData?.estimatedWaitSecForNewArrival)}
          </div>
          <div className="stat-subtext">For new incoming customer</div>
        </div>
      </div>

      {/* Counters Section */}
      <section aria-labelledby="counters-management-heading">
        <div className="staff-section-header">
          <div>
            <h2 id="counters-management-heading" className="form-title" style={{ fontSize: '1.85rem' }}>
              Service Counters
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              Dispatch customers, monitor serving times, and configure counter status.
            </p>
          </div>
        </div>

        <div className="counters-grid">
          {counters.map((counter) => {
            const isServing = !!counter.currentToken;
            const currentToken = counter.currentToken;
            const isEditing = editingCounterId === counter._id;

            // Check if serving time has overrun average
            const elapsedServingSec = currentToken?.calledAt
              ? Math.floor((Date.now() - new Date(currentToken.calledAt).getTime()) / 1000)
              : 0;
            const isOverrun = isServing && elapsedServingSec > avgDuration;

            return (
              <div
                key={counter._id}
                className={`counter-card ${isServing ? 'is-serving' : ''} ${
                  !counter.isActive ? 'is-closed' : ''
                }`}
              >
                {/* Header: Name and Status Badge */}
                <div className="counter-card-header">
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={editingName}
                        maxLength={40}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRenameCounter(counter._id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setEditingCounterId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="counter-name-group">
                        <span className="counter-name-title">{counter.name}</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                          title="Rename Counter"
                          onClick={() => {
                            setEditingCounterId(counter._id);
                            setEditingName(counter.name);
                          }}
                        >
                          ✎
                        </button>
                      </div>

                      <span
                        className={`counter-status-pill ${
                          counter.isActive ? 'status-pill-open' : 'status-pill-closed'
                        }`}
                      >
                        {counter.isActive ? 'Open' : 'Closed'}
                      </span>
                    </>
                  )}
                </div>

                {/* Body: Serving Token or Idle */}
                {isServing && currentToken ? (
                  <div className="counter-serving-stage">
                    <div className="serving-stage-token num-tabular">
                      {currentToken.label}
                    </div>
                    {currentToken.customerName && (
                      <div className="serving-stage-name">
                        👤 {currentToken.customerName}
                      </div>
                    )}
                    {currentToken.note && (
                      <div className="serving-stage-note">
                        "{currentToken.note}"
                      </div>
                    )}

                    <div>
                      <span
                        className={`serving-timer-pill num-tabular ${
                          isOverrun ? 'timer-overrun' : ''
                        }`}
                        title={isOverrun ? 'Serving time is exceeding average' : 'Elapsed time'}
                      >
                        ⏱ Serving: {formatElapsedTime(currentToken.calledAt)}
                        {isOverrun && ' (overrunning)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="counter-idle-stage">
                    <span>{counter.isActive ? 'Ready for Customer' : 'Counter Inactive'}</span>
                    <small>
                      {counter.isActive
                        ? waitingList.length > 0
                          ? 'Click "Call Next" below to serve'
                          : 'Queue is currently empty'
                        : 'Open counter to begin serving'}
                    </small>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="counter-card-actions">
                  <button
                    type="button"
                    className="btn btn-teal btn-lg"
                    style={{ width: '100%' }}
                    disabled={
                      loadingAction ||
                      !counter.isActive ||
                      isServing ||
                      waitingList.length === 0
                    }
                    onClick={() => handleCallNext(counter._id, counter.name)}
                  >
                    📢 Call Next Customer
                  </button>

                  <div className="actions-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={loadingAction || !isServing}
                      onClick={() => handleComplete(counter._id, counter.name)}
                    >
                      ✔ Complete
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      disabled={loadingAction || !isServing}
                      onClick={() => handleNoShow(counter._id, counter.name)}
                    >
                      ⚠️ No-Show
                    </button>
                  </div>

                  <div className="actions-row" style={{ marginTop: '0.2rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={loadingAction || isServing}
                      onClick={() => handleToggleActive(counter)}
                    >
                      {counter.isActive ? 'Close Counter' : 'Open Counter'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      disabled={loadingAction || isServing}
                      onClick={() => handleDeleteCounter(counter)}
                      title="Delete counter"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Counter Card */}
          <div className="add-counter-box">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>+ Add New Counter</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              Open another service desk for peak traffic hours.
            </p>
            <form onSubmit={handleAddCounter} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Counter 2 or Desk B"
                maxLength={40}
                value={newCounterName}
                onChange={(e) => setNewCounterName(e.target.value)}
                disabled={addingCounter}
                required
              />
              <button
                type="submit"
                className="btn btn-navy"
                disabled={addingCounter || !newCounterName.trim()}
              >
                {addingCounter ? 'Adding...' : 'Create Counter'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Waiting List Table */}
      <section aria-labelledby="waiting-table-heading" style={{ marginTop: '1rem' }}>
        <div className="staff-section-header">
          <div>
            <h2 id="waiting-table-heading" className="form-title" style={{ fontSize: '1.85rem' }}>
              Waiting List ({waitingList.length})
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              Live customer queue in order of token issuance.
            </p>
          </div>

          {/* Search Box */}
          {waitingList.length > 0 && (
            <div style={{ maxWidth: '280px', width: '100%' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Filter by token or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.875rem' }}
              />
            </div>
          )}
        </div>

        {waitingList.length === 0 ? (
          <div className="counter-idle-stage" style={{ background: '#ffffff', padding: '3rem 1rem' }}>
            <span style={{ fontSize: '1.25rem' }}>No customers currently waiting</span>
            <small>New arrivals will appear here immediately.</small>
          </div>
        ) : filteredWaiting.length === 0 ? (
          <div className="counter-idle-stage" style={{ background: '#ffffff', padding: '2rem 1rem' }}>
            <span>No tokens match "{searchQuery}"</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setSearchQuery('')}
              style={{ marginTop: '0.5rem' }}
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="queue-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Pos</th>
                  <th>Token</th>
                  <th>Customer Name</th>
                  <th>Note / Reason</th>
                  <th>Waiting For</th>
                  <th>Est. Wait</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaiting.map((token) => {
                  const posClass = token.position <= 3 ? `pos-${token.position}` : '';
                  return (
                    <tr key={token._id}>
                      <td>
                        <span className={`table-pos-badge ${posClass}`}>
                          {token.position}
                        </span>
                      </td>
                      <td>
                        <span className="table-token-badge num-tabular">
                          {token.label}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {token.customerName || <span style={{ color: 'var(--gray-400)' }}>Walk-in</span>}
                      </td>
                      <td style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                        {token.note || '—'}
                      </td>
                      <td className="num-tabular" style={{ color: 'var(--gray-600)' }}>
                        ⏱ {formatElapsedTime(token.createdAt)}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {openCounters.length === 0
                          ? <span style={{ color: 'var(--gray-500)' }}>Counters closed</span>
                          : formatWaitTime(token.estimatedWaitSec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
