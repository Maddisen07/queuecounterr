import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { Token } from '../models/Token.js';
import {
  issueToken,
  getTokenDetails,
  cancelToken
} from '../services/queueService.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// POST /api/tokens - Join the queue
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { customerName, note } = req.body || {};

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      throw new AppError('Customer name is required', 400);
    }
    if (customerName.trim().length > 60) {
      throw new AppError('Customer name cannot exceed 60 characters', 400);
    }

    if (!note || typeof note !== 'string' || !note.trim()) {
      throw new AppError('Service reason is required', 400);
    }
    if (note.trim().length > 120) {
      throw new AppError('Note cannot exceed 120 characters', 400);
    }

    const result = await issueToken({ customerName, note });
    res.status(201).json(result);
  })
);

// GET /api/tokens - List tokens with optional status & limit
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, limit } = req.query;
    const filter = {};

    if (status) {
      const validStatuses = ['waiting', 'serving', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status filter '${status}'`, 400);
      }
      filter.status = status;
    }

    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const tokens = await Token.find(filter)
      .populate('counter', 'name isActive')
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    res.json({ tokens });
  })
);

// GET /api/tokens/:id - Token status, position, and wait estimate
router.get(
  '/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await getTokenDetails(req.params.id);
    res.json(result);
  })
);

// POST /api/tokens/:id/cancel - Leave queue (waiting tokens only)
router.post(
  '/:id/cancel',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const updatedToken = await cancelToken(req.params.id);
    res.json({
      message: 'Token cancelled successfully',
      token: updatedToken
    });
  })
);

export default router;
