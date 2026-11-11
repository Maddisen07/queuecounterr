import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api.js';
import { usePolling, formatWaitTime, formatElapsedTime } from '../hooks.js';
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

  // Ticker for serving elapsed time
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

  // Polling every 3.5s
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
  const avgDuration = queueData?.averageServiceTimeSec;

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

      {/* Stats Row */}
      <div className="queue-summary-banner">
        <div className="summary-stat">
          <span className="stat-label">Waiting in Queue</span>
          <span className="stat-value">{waitingList.length}</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Open Counters</span>
          <span className="stat-value">
            {openCounters.length} / {counters.length}
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Average Service Time</span>
          <span className="stat-value">
            {avgDuration ? formatWaitTime(avgDuration, { precise: true }) : '5m'}
          </span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Next Arrival Est. Wait</span>
          <span className="stat-value">
            {openCounters.length === 0
              ? 'None (Closed)'
              : formatWaitTime(queueData?.estimatedWaitSecForNewArrival)}
          </span>
        </div>
      </div>

      {/* Counters Section */}
      <section aria-labelledby="counters-heading">
        <h2 id="counters-heading" className="form-title" style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          Service Counters
        </h2>

        <div className="counters-grid">
          {counters.map((counter) => {
            const isServing = !!counter.currentToken;
            const currentToken = counter.currentToken;
            const isEditing = editingCounterId === counter._id;

            return (
              <div
                key={counter._id}
                className={`counter-card ${isServing ? 'is-serving' : ''} ${
                  !counter.isActive ? 'is-closed' : ''
                }`}
              >
                {/* Header: Name and Status */}
                <div className="counter-card-header">
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="counter-name-title">{counter.name}</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
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
                        className={`counter-badge ${
                          counter.isActive ? 'badge-open' : 'badge-closed'
                        }`}
                      >
                        {counter.isActive ? 'Open' : 'Closed'}
                      </span>
                    </>
                  )}
                </div>

                {/* Body: Serving Token or Idle */}
                {isServing && currentToken ? (
                  <div className="counter-serving-box">
                    <div className="serving-token-label">{currentToken.label}</div>
                    {currentToken.customerName && (
                      <div className="serving-customer-name">
                        {currentToken.customerName}
                      </div>
                    )}
                    {currentToken.note && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontStyle: 'italic' }}>
                        "{currentToken.note}"
                      </div>
                    )}
                    <div className="serving-elapsed-timer">
                      ⏱ Serving for: {formatElapsedTime(currentToken.calledAt)}
                    </div>
                  </div>
                ) : (
                  <div className="counter-idle-box">
                    {counter.isActive ? 'Idle — Ready for customer' : 'Counter is closed'}
                  </div>
                )}

                {/* Actions */}
                <div className="counter-card-actions">
                  {/* Call Next Button */}
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
                    📢 Call Next
                  </button>

                  {/* Complete & No-Show Buttons */}
                  <div className="counter-action-row">
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

                  {/* Open/Close & Delete Row */}
                  <div className="counter-action-row" style={{ marginTop: '0.25rem' }}>
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
          <div className="add-counter-card">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add New Counter</h3>
            <form onSubmit={handleAddCounter} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Counter 2"
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
                {addingCounter ? 'Adding...' : '+ Add Counter'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Waiting List Table */}
      <section aria-labelledby="waiting-list-heading">
        <h2 id="waiting-list-heading" className="form-title" style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          Waiting List ({waitingList.length})
        </h2>

        {waitingList.length === 0 ? (
          <div className="counter-idle-box" style={{ background: '#ffffff', border: '1px solid var(--gray-200)' }}>
            No customers currently waiting in the queue.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Token</th>
                  <th>Customer Name</th>
                  <th>Note</th>
                  <th>Waiting For</th>
                  <th>Estimated Wait</th>
                </tr>
              </thead>
              <tbody>
                {waitingList.map((token) => (
                  <tr key={token._id}>
                    <td style={{ fontWeight: 700, color: 'var(--gray-500)' }}>
                      #{token.position}
                    </td>
                    <td>
                      <span className="table-token-pill">{token.label}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {token.customerName || '—'}
                    </td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                      {token.note || '—'}
                    </td>
                    <td>{formatElapsedTime(token.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {openCounters.length === 0
                        ? 'Counters closed'
                        : formatWaitTime(token.estimatedWaitSec)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
