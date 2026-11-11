import mongoose from 'mongoose';

/**
 * Middleware generator to validate route param is a valid MongoDB ObjectId
 * @param {string} [paramName='id']
 */
export function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: `Invalid identifier format for parameter '${paramName}'`,
        details: { [paramName]: id }
      });
    }
    next();
  };
}
