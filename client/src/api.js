const API_BASE = '/api';

/**
 * Custom API Error class with HTTP status code and details
 */
export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Generic request helper
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkError) {
    throw new ApiError(
      'Unable to connect to the server. Please check your network connection.',
      0
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage = data?.error || `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, response.status, data?.details);
  }

  return data;
}

// Tokens API
export const api = {
  // Join the queue
  joinQueue: (data) =>
    request('/tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Get token status & position
  getToken: (id) => request(`/tokens/${encodeURIComponent(id)}`),

  // Leave queue (cancel)
  cancelToken: (id) =>
    request(`/tokens/${encodeURIComponent(id)}/cancel`, {
      method: 'POST'
    }),

  // List tokens
  listTokens: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', params.limit);
    const qs = query.toString();
    return request(`/tokens${qs ? `?${qs}` : ''}`);
  },

  // Queue snapshot
  getQueue: () => request('/queue'),

  // Counters API
  getCounters: () => request('/counters'),

  createCounter: (name) =>
    request('/counters', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  updateCounter: (id, updates) =>
    request(`/counters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),

  deleteCounter: (id) =>
    request(`/counters/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  callNext: (counterId) =>
    request(`/counters/${encodeURIComponent(counterId)}/call-next`, {
      method: 'POST'
    }),

  completeService: (counterId) =>
    request(`/counters/${encodeURIComponent(counterId)}/complete`, {
      method: 'POST'
    }),

  noShow: (counterId) =>
    request(`/counters/${encodeURIComponent(counterId)}/no-show`, {
      method: 'POST'
    }),

  // Health check
  getHealth: () => request('/health')
};
