import { GoogleGenAI } from '@google/genai';
import { OrderModel } from '../models/Order';
import pino from 'pino';

const logger = pino({ name: 'ai-summarizer' });

// In production, ensure process.env.GEMINI_API_KEY is set.
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {});

let cachedSummary: string | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 60 * 1000; // Increase cache TTL to 60 seconds to reduce quota usage
let pendingPromise: Promise<string> | null = null;

export const getPrepSummary = async (): Promise<string> => {
  const now = Date.now();

  // If we have a fresh cached summary, return it immediately
  if (cachedSummary && (now - lastFetchTime) < CACHE_TTL) {
    return cachedSummary;
  }

  // If there is an in-flight API request, return the pending promise so all concurrent requests share it
  if (pendingPromise) {
    return pendingPromise;
  }

  // Define the fetch execution function
  const executeFetch = async (): Promise<string> => {
    try {
      const activeOrders = await OrderModel.find({
        status: { $in: ['received', 'cooking'] }
      }).lean();

      if (activeOrders.length === 0) {
        cachedSummary = "NO ACTIVE ORDERS. KITCHEN IS CLEAR.";
        lastFetchTime = Date.now();
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
      lastFetchTime = Date.now();
      return cachedSummary;

    } catch (error) {
      logger.error({ err: error }, 'Failed to generate prep summary via Gemini API — running fallback aggregator');
      
      // Cache the fallback state for 30 seconds to respect rate limits
      lastFetchTime = Date.now() - (CACHE_TTL - 30000); 

      // Programmatic fallback builder: Consolidates active items and extracts allergy warnings
      try {
        const activeOrders = await OrderModel.find({
          status: { $in: ['received', 'cooking'] }
        }).lean();

        if (activeOrders.length === 0) {
          cachedSummary = "NO ACTIVE ORDERS. KITCHEN IS CLEAR.";
          return cachedSummary;
        }

        // Aggregate quantities per item name
        const counts: Record<string, { qty: number; stations: Set<string> }> = {};
        const allergies: string[] = [];

        activeOrders.forEach(order => {
          order.items.forEach(item => {
            const key = item.name.trim();
            if (!counts[key]) {
              counts[key] = { qty: 0, stations: new Set() };
            }
            counts[key].qty += item.quantity;
            if (item.station) counts[key].stations.add(item.station);

            // Scan notes for allergy keywords
            if (item.notes) {
              const notesLower = item.notes.toLowerCase();
              if (notesLower.includes('allergy') || notesLower.includes('allergies') || notesLower.includes('no ') || notesLower.includes('avoid')) {
                allergies.push(`T${order.tableNumber}: ${item.name} (${item.notes})`);
              }
            }
          });
        });

        let summaryStr = `[ FALLBACK PREP SUMMARY ]\n`;
        summaryStr += `ACTIVE ORDERS: ${activeOrders.length} | TOTAL ITEMS: ${activeOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}\n\n`;
        
        summaryStr += `CONSOLIDATED QUEUE:\n`;
        Object.entries(counts).forEach(([name, data]) => {
          const stationsStr = data.stations.size > 0 ? ` [${Array.from(data.stations).join('/')}]` : '';
          summaryStr += `  ${data.qty}x ${name.toUpperCase()}${stationsStr.toUpperCase()}\n`;
        });

        if (allergies.length > 0) {
          summaryStr += `\nCRITICAL ALLERGY WARNINGS:\n`;
          allergies.forEach(warn => {
            summaryStr += `  ⚠ ${warn.toUpperCase()}\n`;
          });
        } else {
          summaryStr += `\nNO ALLERGIES DETECTED.\n`;
        }

        cachedSummary = summaryStr.trim();
        return cachedSummary;
      } catch (fallbackError) {
        logger.error({ err: fallbackError }, 'Fallback aggregator failed');
        return "AI SERVICE OFFLINE (FALLBACK FAILED).";
      }
    } finally {
      // Clear the pending promise once execution is done
      pendingPromise = null;
    }
  };

  pendingPromise = executeFetch();
  return pendingPromise;
};
