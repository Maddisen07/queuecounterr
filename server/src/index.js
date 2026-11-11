import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedDefaultCounter } from './services/queueService.js';

const PORT = process.env.PORT || 5000;
const app = createApp();

// Lazily initialize and reuse DB connection for Vercel and local runs
let isDbInit = false;
export async function initDatabase() {
  if (isDbInit) return;
  try {
    await connectDB();
    await seedDefaultCounter();
    isDbInit = true;
  } catch (err) {
    console.error('Database initialization warning:', err.message);
  }
}

// Ensure DB connection on any request (critical for serverless / Vercel execution)
app.use(async (req, res, next) => {
  if (!isDbInit) {
    await initDatabase();
  }
  next();
});

// If run as a standalone server (local dev, docker, or non-Vercel environment)
if (!process.env.VERCEL) {
  initDatabase().then(() => {
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

      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  });
}

// Export default app for Vercel Express framework
export default app;
