import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { calculateQueueSnapshot } from '../services/queueService.js';

const router = express.Router();

// GET /api/queue - Snapshot with counters, waiting list with estimates, avg service time, open counter count, estimated wait for new arrival
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const snapshot = await calculateQueueSnapshot();
    res.json(snapshot);
  })
);

export default router;
