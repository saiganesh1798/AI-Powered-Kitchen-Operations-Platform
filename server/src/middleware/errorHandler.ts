import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err }, 'Unhandled error caught by middleware');
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    details: err.details || undefined,
  });
}
