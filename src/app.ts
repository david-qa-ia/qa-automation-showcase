import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { pool } from './db.js';
import { ApiError, errorHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { productsRouter } from './routes/products.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));

  app.use(express.static(publicDir));
  app.use(errorHandler);
  return app;
}
