import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import pinoHttp from 'pino-http';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { connectDB } from './config/db';
import { initializeSocket } from './socket';
import { ordersRouter } from './routes/orders';
import { analyticsRouter } from './routes/analytics';
import { inventoryRouter } from './routes/inventory';
import { errorHandler } from './middleware/errorHandler';

const logger = pino({ name: 'server' });

async function bootstrap() {
  // Validate env
  const PORT = process.env.PORT || 3001;
  const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'];
  
  if (!process.env.MONGODB_URI) {
    logger.fatal('MONGODB_URI is required');
    process.exit(1);
  }

  await connectDB();

  const app = express();
  const httpServer = createServer(app);

  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: CORS_ORIGINS }));
  app.use(express.json());

  // Rate limiting for order creation
  const orderLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per `window`
    message: 'Too many orders created from this IP, please try again later.',
  });

  // Routes
  app.use('/api/orders', orderLimiter, ordersRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/inventory', inventoryRouter);
  
  app.get('/api/health', (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    if (!dbConnected) {
      res.status(503).json({ status: 'error', db: 'disconnected' });
      return;
    }
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: process.uptime(),
    });
  });

  // Error handling
  app.use(errorHandler);

  // Socket
  initializeSocket(httpServer, CORS_ORIGINS);

  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to bootstrap server');
  process.exit(1);
});
