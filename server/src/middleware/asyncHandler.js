/**
 * Wraps async Express route handlers to catch rejected promises and forward them to next()
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
