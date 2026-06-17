import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({ name: 'db' });

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in environment');
    
    await mongoose.connect(uri);
    isConnected = true;
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to connect to MongoDB');
    process.exit(1);
  }
};
