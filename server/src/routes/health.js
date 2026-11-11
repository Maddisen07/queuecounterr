import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/health - Service health check
router.get('/', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.json({
    status: isDbConnected ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      connected: isDbConnected,
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
    }
  });
});

export default router;
