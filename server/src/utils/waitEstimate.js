/**
 * Calculates average service time and queue wait-time estimates.
 * 
 * Rules:
 * - Average service time = mean of the last 20 completed services; default 5 minutes (300s) until data exists.
 * - Each open counter has a "free in" time: 0 if idle, otherwise max(0, avg - spent).
 * - Walk waiting list in order; each person takes counter that frees up first,
 *   which then stays busy for one more average service.
 * - If no counters are open, return null estimate.
 *
 * @param {Object} options
 * @param {Array<Object>} options.openCounters - Array of active counters { id, currentToken: { calledAt } | null }
 * @param {Array<Object>} options.waitingTokens - Array of waiting tokens in queue order [{ id, ... }]
 * @param {Array<number>} [options.completedDurations=[]] - Array of recent completed service durations in seconds (up to 20)
 * @param {number} [options.now=Date.now()] - Current epoch timestamp in milliseconds
 * @param {number} [options.defaultAvgSec=300] - Default average service time in seconds (5 minutes)
 * @returns {Object} { averageServiceTimeSec: number, tokenEstimates: Map<string, number | null>, nextArrivalWaitSec: number | null }
 */
export function calculateWaitEstimates({
  openCounters = [],
  waitingTokens = [],
  completedDurations = [],
  now = Date.now(),
  defaultAvgSec = 300
} = {}) {
  // 1. Calculate average service time (mean of last up to 20 completed services)
  let averageServiceTimeSec = defaultAvgSec;
  const validDurations = completedDurations
    .slice(0, 20)
    .filter(d => typeof d === 'number' && !Number.isNaN(d) && d >= 0);

  if (validDurations.length > 0) {
    const sum = validDurations.reduce((acc, val) => acc + val, 0);
    averageServiceTimeSec = Math.max(1, Math.round(sum / validDurations.length));
  }

  // 2. If no counters are open, return null estimate
  if (!openCounters || openCounters.length === 0) {
    const tokenEstimates = new Map();
    for (const token of waitingTokens) {
      const tokenId = String(token.id || token._id || token);
      tokenEstimates.set(tokenId, null);
    }
    return {
      averageServiceTimeSec,
      tokenEstimates,
      nextArrivalWaitSec: null
    };
  }

  // 3. Initialize "free in" time for each open counter
  const counterFreeTimes = openCounters.map(counter => {
    const currentToken = counter.currentToken;
    if (!currentToken || !currentToken.calledAt) {
      return 0; // idle
    }

    const calledAtMs = new Date(currentToken.calledAt).getTime();
    const timeSpentSec = Math.max(0, Math.floor((now - calledAtMs) / 1000));
    return Math.max(0, averageServiceTimeSec - timeSpentSec);
  });

  // 4. Walk the waiting list in order
  const tokenEstimates = new Map();
  for (const token of waitingTokens) {
    const tokenId = String(token.id || token._id || token);

    // Find the counter that frees up first (minimum freeIn time)
    let minIdx = 0;
    for (let i = 1; i < counterFreeTimes.length; i++) {
      if (counterFreeTimes[i] < counterFreeTimes[minIdx]) {
        minIdx = i;
      }
    }

    // Token waits until that counter is free
    const waitSec = counterFreeTimes[minIdx];
    tokenEstimates.set(tokenId, waitSec);

    // That counter now stays busy for one more average service
    counterFreeTimes[minIdx] += averageServiceTimeSec;
  }

  // 5. Next arrival takes the counter that frees up first after all waiting tokens
  const nextArrivalWaitSec = Math.min(...counterFreeTimes);

  return {
    averageServiceTimeSec,
    tokenEstimates,
    nextArrivalWaitSec
  };
}
