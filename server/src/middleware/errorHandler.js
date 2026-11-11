/**
 * Central Error Handler
 * Formats all errors as { error: string, details?: any }
 * Prevents internal details leaking on 500
 */
export function errorHandler(err, req, res, next) {
  // 1. SyntaxError from express.json() bad JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload received',
      details: err.message
    });
  }

  // 2. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation failed',
      details
    });
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid ${err.path}: ${err.value}`,
      details: err.message
    });
  }

  // 4. MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'resource';
    return res.status(409).json({
      error: `Duplicate value for field '${field}'. It must be unique.`,
      details: err.keyValue
    });
  }

  // 5. Explicit application errors with statusCode
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({
      error: err.message || 'Client error',
      ...(err.details ? { details: err.details } : {})
    });
  }

  // 6. Generic 500 Internal Server Error (Never leak internals)
  console.error('[Internal Server Error]', err);
  return res.status(500).json({
    error: 'An internal server error occurred. Please try again later.'
  });
}

/**
 * Helper to create an HTTP error with a status code
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
