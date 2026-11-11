import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { Counter } from '../models/Counter.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  callNextToCounter,
  completeCurrentToken,
  noShowCurrentToken,
  updateCounter,
  deleteCounter
} from '../services/queueService.js';

const router = express.Router();

// GET /api/counters - List all counters
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const counters = await Counter.find()
      .populate('currentToken')
      .sort({ createdAt: 1 });
    res.json({ counters });
  })
);

// POST /api/counters - Create new counter
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Counter name is required', 400);
    }

    const trimmed = name.trim();
    if (trimmed.length > 40) {
      throw new AppError('Counter name cannot exceed 40 characters', 400);
    }

    const existing = await Counter.findOne({ name: trimmed });
    if (existing) {
      throw new AppError(`A counter named '${trimmed}' already exists`, 409);
    }

    const counter = await Counter.create({
      name: trimmed,
      isActive: true
    });

    res.status(201).json({ counter });
  })
);

// PATCH /api/counters/:id - Rename, open/close
router.patch(
  '/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const { name, isActive } = req.body || {};
    const updatedCounter = await updateCounter(req.params.id, { name, isActive });
    res.json({ counter: updatedCounter });
  })
);

// DELETE /api/counters/:id - Delete counter (not while serving)
router.delete(
  '/:id',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await deleteCounter(req.params.id);
    res.json(result);
  })
);

// POST /api/counters/:id/call-next - Assign oldest waiting token to counter
router.post(
  '/:id/call-next',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await callNextToCounter(req.params.id);
    res.json(result);
  })
);

// POST /api/counters/:id/complete - Finish current token & record duration
router.post(
  '/:id/complete',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await completeCurrentToken(req.params.id);
    res.json({
      message: 'Customer service completed',
      ...result
    });
  })
);

// POST /api/counters/:id/no-show - Free counter without duration
router.post(
  '/:id/no-show',
  validateObjectId('id'),
  asyncHandler(async (req, res) => {
    const result = await noShowCurrentToken(req.params.id);
    res.json({
      message: 'Customer marked as no-show',
      ...result
    });
  })
);

export default router;
