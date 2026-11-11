import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateWaitEstimates } from '../utils/waitEstimate.js';

describe('Wait-Time Estimate Unit Tests', () => {
  const now = 1700000000000; // Fixed timestamp for deterministic tests

  test('1. no data: defaults to 5 minutes (300 seconds) when no completed service history exists', () => {
    const openCounters = [{ id: 'c1', currentToken: null }];
    const waitingTokens = [{ id: 't1' }];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations: [],
      now
    });

    assert.equal(result.averageServiceTimeSec, 300);
    assert.equal(result.tokenEstimates.get('t1'), 0); // idle counter -> 0 wait
    assert.equal(result.nextArrivalWaitSec, 300); // after t1 is served
  });

  test('2. idle counter: waiting token has 0s wait, next arrival wait is 1 average service duration', () => {
    // 2 completed services with durations 180s and 220s -> mean is 200s
    const completedDurations = [180, 220];
    const openCounters = [{ id: 'c1', currentToken: null }];
    const waitingTokens = [{ id: 't1' }, { id: 't2' }];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations,
      now
    });

    assert.equal(result.averageServiceTimeSec, 200);
    // t1 gets idle counter right away
    assert.equal(result.tokenEstimates.get('t1'), 0);
    // t2 waits for t1 to complete (200s)
    assert.equal(result.tokenEstimates.get('t2'), 200);
    // next arrival wait is 400s
    assert.equal(result.nextArrivalWaitSec, 400);
  });

  test('3. busy counter: wait is average minus time already spent on current customer', () => {
    // Average service time is 300s
    // Current customer was called 100 seconds ago
    const calledAt = new Date(now - 100 * 1000).toISOString();
    const openCounters = [
      { id: 'c1', currentToken: { calledAt } }
    ];
    const waitingTokens = [{ id: 't1' }, { id: 't2' }];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations: [300],
      now
    });

    assert.equal(result.averageServiceTimeSec, 300);
    // c1 is busy, time spent = 100s. Free in 300 - 100 = 200s.
    assert.equal(result.tokenEstimates.get('t1'), 200);
    // t2 waits for t1 to finish: 200 + 300 = 500s.
    assert.equal(result.tokenEstimates.get('t2'), 500);
    assert.equal(result.nextArrivalWaitSec, 800);
  });

  test('4. multiple counters: greedy allocation to earliest free counter', () => {
    // Average service time: 240s
    // Counter 1: Idle (free in 0s)
    // Counter 2: Busy, spent 180s (free in 240 - 180 = 60s)
    // Counter 3: Busy, spent 60s (free in 240 - 60 = 180s)
    const openCounters = [
      { id: 'c1', currentToken: null },
      { id: 'c2', currentToken: { calledAt: new Date(now - 180 * 1000) } },
      { id: 'c3', currentToken: { calledAt: new Date(now - 60 * 1000) } }
    ];
    const waitingTokens = [
      { id: 't1' },
      { id: 't2' },
      { id: 't3' },
      { id: 't4' }
    ];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations: [240],
      now
    });

    assert.equal(result.averageServiceTimeSec, 240);
    // Initial free times: c1: 0, c2: 60, c3: 180
    // t1 takes c1 (0s) -> c1 now free in 0 + 240 = 240s
    assert.equal(result.tokenEstimates.get('t1'), 0);
    // Free times now: c1: 240, c2: 60, c3: 180
    // t2 takes c2 (60s) -> c2 now free in 60 + 240 = 300s
    assert.equal(result.tokenEstimates.get('t2'), 60);
    // Free times now: c1: 240, c2: 300, c3: 180
    // t3 takes c3 (180s) -> c3 now free in 180 + 240 = 420s
    assert.equal(result.tokenEstimates.get('t3'), 180);
    // Free times now: c1: 240, c2: 300, c3: 420
    // t4 takes c1 (240s) -> c1 now free in 240 + 240 = 480s
    assert.equal(result.tokenEstimates.get('t4'), 240);
    // Next arrival wait is min(480, 300, 420) = 300s
    assert.equal(result.nextArrivalWaitSec, 300);
  });

  test('5. overrunning service: spent time > average service time clamps free-in time to 0', () => {
    // Average is 200s, but customer has been at counter for 350s
    const calledAt = new Date(now - 350 * 1000);
    const openCounters = [
      { id: 'c1', currentToken: { calledAt } }
    ];
    const waitingTokens = [{ id: 't1' }];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations: [200],
      now
    });

    assert.equal(result.averageServiceTimeSec, 200);
    // Math.max(0, 200 - 350) = 0
    assert.equal(result.tokenEstimates.get('t1'), 0);
    assert.equal(result.nextArrivalWaitSec, 200);
  });

  test('6. no open counters: returns null estimate and null nextArrivalWaitSec', () => {
    const openCounters = [];
    const waitingTokens = [{ id: 't1' }, { id: 't2' }];

    const result = calculateWaitEstimates({
      openCounters,
      waitingTokens,
      completedDurations: [120, 150],
      now
    });

    assert.equal(result.averageServiceTimeSec, 135);
    assert.equal(result.tokenEstimates.get('t1'), null);
    assert.equal(result.tokenEstimates.get('t2'), null);
    assert.equal(result.nextArrivalWaitSec, null);
  });

  test('7. only last 20 completed durations are used for the average calculation', () => {
    // 30 durations: first 20 are 100, remaining 10 are 500
    const completedDurations = [
      ...Array(20).fill(100),
      ...Array(10).fill(500)
    ];
    const result = calculateWaitEstimates({
      openCounters: [{ id: 'c1', currentToken: null }],
      waitingTokens: [],
      completedDurations
    });
    // Should take slice(0, 20), mean of 20 x 100 = 100
    assert.equal(result.averageServiceTimeSec, 100);
  });
});
