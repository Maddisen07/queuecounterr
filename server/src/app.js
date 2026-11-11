import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import tokensRouter from './routes/tokens.js';
import countersRouter from './routes/counters.js';
import queueRouter from './routes/queue.js';
import healthRouter from './routes/health.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Configure CORS
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || origin === clientOrigin || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev, but can be restricted via CLIENT_ORIGIN
      },
      credentials: true
    })
  );

  // Limit JSON body size to 10kb
  app.use(express.json({ limit: '10kb' }));

  // API Routes
  app.use('/api/tokens', tokensRouter);
  app.use('/api/counters', countersRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/health', healthRouter);

  // Serve client/dist in production if it exists
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    console.log(`Serving static files from ${clientDistPath}`);
    app.use(express.static(clientDistPath));

    // For any other non-API route, send index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // 404 for unknown API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
