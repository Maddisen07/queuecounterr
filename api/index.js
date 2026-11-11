import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { seedDefaultCounter } from '../server/src/services/queueService.js';

let appInstance = null;
let initPromise = null;

async function ensureAppAndDB() {
  if (!appInstance) {
    appInstance = createApp();
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await connectDB();
        await seedDefaultCounter();
      } catch (err) {
        console.error('Failed to initialize MongoDB in Vercel serverless function:', err.message);
        initPromise = null; // Allow retry on subsequent requests
        throw err;
      }
    })();
  }

  await initPromise;
  return appInstance;
}

export default async function handler(req, res) {
  try {
    const app = await ensureAppAndDB();
    return app(req, res);
  } catch (err) {
    console.error('Vercel API Handler Error:', err.message);
    return res.status(500).json({
      error: 'Database connection failed. Please verify that MONGODB_URI is configured in your Vercel Project Environment Variables and that Network Access in MongoDB Atlas allows access (0.0.0.0/0).',
      details: err.message
    });
  }
}
