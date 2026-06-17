import { Server } from 'socket.io';
import { InventoryModel } from '../models/Inventory';
import { EVENTS } from '../../../shared/socket/events';
import type { OrderItem } from '../../../shared/types';
import pino from 'pino';

const logger = pino({ name: 'inventory-depletion' });

/**
 * Called when an order transitions received → cooking.
 * For each item, atomically decrements matching ingredient stock by quantity.
 * If stockLevel drops at or below criticalThreshold, emits INVENTORY_ALERT to all connected clients.
 */
export async function depleteInventory(
  io: Server,
  items: OrderItem[]
): Promise<void> {
  for (const item of items) {
    const ingredientKey = item.name.toLowerCase().trim();

    try {
      // Atomic find-and-decrement — only if ingredient is tracked
      const updated = await InventoryModel.findOneAndUpdate(
        { ingredientName: ingredientKey },
        { $inc: { stockLevel: -item.quantity } },
        { new: true }
      ).lean();

      if (!updated) {
        // Item not tracked in inventory — skip silently
        continue;
      }

      logger.info(
        { ingredient: ingredientKey, remaining: updated.stockLevel },
        `[INVENTORY] Depleted ${item.quantity}× ${ingredientKey} → ${updated.stockLevel} ${updated.unit} remaining`
      );

      // Emit alert if stock has hit or breached the critical threshold
      if (updated.stockLevel <= updated.criticalThreshold) {
        const alertPayload = {
          ingredientName: updated.ingredientName,
          stockLevel:     updated.stockLevel,
          unit:           updated.unit,
          threshold:      updated.criticalThreshold,
          message:        `⚠ LOW STOCK: ${updated.ingredientName.toUpperCase()} — ${updated.stockLevel} ${updated.unit} remaining (threshold: ${updated.criticalThreshold})`,
        };

        io.emit(EVENTS.INVENTORY_ALERT, alertPayload);

        logger.warn(
          { alert: alertPayload },
          `[INVENTORY] Critical threshold breached for ${ingredientKey}`
        );
      }
    } catch (err) {
      // Never crash the order flow due to inventory errors
      logger.error(
        { err, ingredient: ingredientKey },
        '[INVENTORY] Failed to deplete ingredient — order flow unaffected'
      );
    }
  }
}
