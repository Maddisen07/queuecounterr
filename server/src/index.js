import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDefaultCounter } from './services/queueService.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  const app = createApp();

  try {
    // Connect to MongoDB (Atlas or local)
    await connectDB();

    // Seed default counter if none exists
    await seedDefaultCounter();
  } catch (err) {
    console.error('Database initialization warning:', err.message);
    console.warn('Server will continue running in degraded mode so /api/health is reachable.');
  }

  const server = app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 QueueCounter API running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
    console.log(`==================================================\n`);
  });

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      console.log('HTTP server closed.');
      await disconnectDB();
      console.log('QueueCounter stopped.');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

startServer();
