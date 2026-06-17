import { GoogleGenAI } from '@google/genai';
import { OrderModel } from '../models/Order';
import pino from 'pino';

const logger = pino({ name: 'ai-summarizer' });

// In production, ensure process.env.GEMINI_API_KEY is set.
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {});

let cachedSummary: string | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

export const getPrepSummary = async (): Promise<string> => {
  const now = Date.now();
  if (cachedSummary && (now - lastFetchTime) < CACHE_TTL) {
    return cachedSummary;
  }

  try {
    const activeOrders = await OrderModel.find({
      status: { $in: ['received', 'cooking'] }
    }).lean();

    if (activeOrders.length === 0) {
      cachedSummary = "NO ACTIVE ORDERS. KITCHEN IS CLEAR.";
      lastFetchTime = now;
      return cachedSummary;
    }

    const itemsList = activeOrders.flatMap(order => 
      order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes || ''
      }))
    );

    const prompt = `
You are an expert culinary AI aggregator. Analyze the following active order items and modification notes.
Produce a highly compressed, plain-text summary suitable for a monospace dashboard.
Include total counts for each distinct item, and loudly highlight any critical allergy warnings derived from the notes.
Do not include conversational text, markdown formatting (like backticks), or explanations. Just the compressed data block.

Active Items:
${JSON.stringify(itemsList, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || "ERROR GENERATING SUMMARY.";
    
    cachedSummary = text.trim();
    lastFetchTime = now;
    return cachedSummary;

  } catch (error) {
    logger.error({ err: error }, 'Failed to generate prep summary');
    // Fallback gracefully without locking the core rendering loop
    return cachedSummary || "AI SERVICE OFFLINE.";
  }
};
