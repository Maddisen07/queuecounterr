import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hash router hook for simple, library-free routing (#/join, #/staff, #/board)
 */
export function useHashRoute(defaultHash = '#/join') {
  const getHash = () => {
    const hash = window.location.hash;
    return hash && hash.startsWith('#/') ? hash : defaultHash;
  };

  const [currentHash, setCurrentHash] = useState(getHash);

  useEffect(() => {
    // If no initial hash, set it
    if (!window.location.hash || !window.location.hash.startsWith('#/')) {
      window.location.hash = defaultHash;
    }

    const onHashChange = () => {
      setCurrentHash(getHash());
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [defaultHash]);

  const navigate = useCallback((newHash) => {
    window.location.hash = newHash;
  }, []);

  return [currentHash, navigate];
}

/**
 * Polling hook that fetches on mount and every intervalMs (e.g. 3500ms).
 * Prevents overlapping in-flight requests.
 */
export function usePolling(fetchFn, intervalMs = 3500, enabled = true) {
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    if (!enabled || isFetchingRef.current || !isMountedRef.current) return;
    try {
      isFetchingRef.current = true;
      await fetchFn();
    } finally {
      isFetchingRef.current = false;
    }
  }, [fetchFn, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Run immediately
    execute();

    const intervalId = setInterval(() => {
      execute();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [execute, intervalMs, enabled]);
}

/**
 * Local storage hook with error handling
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (valueToStore === null || valueToStore === undefined) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * Formats seconds into human-readable duration, e.g. "4m 12s", "About 5 min", "Under 1 min"
 */
export function formatWaitTime(sec, options = {}) {
  if (sec === null || sec === undefined) {
    return options.fallbackText || 'No estimate';
  }
  if (sec === 0) {
    return 'Immediate';
  }
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;

  if (options.precise) {
    if (minutes === 0) return `${seconds}s`;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  if (minutes === 0) {
    return 'Under 1 min';
  }
  if (minutes === 1) {
    return 'About 1 min';
  }
  return `About ${minutes} mins`;
}

/**
 * Formats time elapsed from a past date string/ms
 */
export function formatElapsedTime(since) {
  if (!since) return '0s';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s < 10 ? '0' : ''}${s}s`;
}
