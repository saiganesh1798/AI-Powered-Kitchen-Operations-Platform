import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrderModel } from '../models/Order';
import { validateTransition } from '../utils/statusGuard';
import { getIO } from '../socket';
import { EVENTS } from '../../../shared/socket/events';
import { sendOrderSms } from '../services/sms';
import { depleteInventory } from '../services/inventoryDepletion';

export const ordersRouter = Router();

const orderItemSchema = z.object({
  name: z.string().min(1).trim(),
  quantity: z.number().int().min(1),
  notes: z.string().trim().optional(),
  station: z.enum(['grill', 'fry', 'prep', 'assembly']).optional(),
});

const createOrderSchema = z.object({
  tableNumber: z.number().int().min(1),
  items: z.array(orderItemSchema).min(1),
  phone: z.string().trim().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['received', 'cooking', 'ready', 'served']),
});

// POST /api/orders
ordersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createOrderSchema.parse(req.body);
    
    // Create and save the order first
    const order = new OrderModel({
      ...validated,
      status: 'received'
    });
    
    const savedOrder = await order.save();
    
    // Then emit the event
    const io = getIO();
    if (io) {
        io.emit(EVENTS.ORDER_RECEIVED, savedOrder.toObject());
    }

    res.status(201).json(savedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
    } else {
      next(error);
    }
  }
});

// PATCH /api/orders/:id/status
ordersRouter.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = updateStatusSchema.parse(req.body);
    
    const order = await OrderModel.findById(id).lean();
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (!validateTransition(order.status, validated.status)) {
      res.status(400).json({ error: `Invalid status transition: ${order.status} -> ${validated.status}` });
      return;
    }

    const updateData: any = { status: validated.status };
    if (validated.status === 'cooking') {
      updateData.cookingStartedAt = new Date();
    } else if (validated.status === 'ready') {
      updateData.readyAt = new Date();
    }

    const updated = await OrderModel.findByIdAndUpdate(
      id, 
      updateData,
      { new: true }
    ).lean();

    if (updated && updated.phone) {
      if (validated.status === 'cooking') {
        await sendOrderSms(updated.phone, `The chef has started preparing your order for Table ${updated.tableNumber}! 🍳`);
      } else if (validated.status === 'ready') {
        await sendOrderSms(updated.phone, `Order Up! Your meal is hot and ready for pickup at the counter! 🍔✨`);
      }
    }

    const io = getIO();
    if (io && updated) {
        // Fire-and-forget inventory depletion on received → cooking
        if (validated.status === 'cooking' && updated.items?.length) {
          depleteInventory(io, updated.items as any).catch(() => {});
        }
        io.emit(EVENTS.STATUS_UPDATED, updated);
        if (validated.status === 'ready') {
            io.emit(EVENTS.ORDER_COMPLETED, updated);
        }
    }

    res.status(200).json(updated);
  } catch (error) {
     if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
    } else {
      next(error);
    }
  }
});

// GET /api/orders/active
ordersRouter.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOrders = await OrderModel
        .find({ status: { $in: ['received', 'cooking'] } })
        .sort({ createdAt: 1 })
        .lean();
    res.json(activeOrders);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders/history?date=YYYY-MM-DD
 * Returns all served orders for the given calendar day (defaults to today).
 * Each order is enriched with:
 *   - prepDurationMs  : readyAt - createdAt
 *   - cookDurationMs  : readyAt - cookingStartedAt
 *   - totalItems      : sum of item quantities
 */
ordersRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateParam = typeof req.query['date'] === 'string' ? req.query['date'] : null;
    const tz = 'Asia/Kolkata'; // IST — adjust per deployment region

    // Build midnight-to-midnight UTC window for the requested date
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const query: any = {
      status:    'served',
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    };

    const orders = await OrderModel
      .find(query)
      .sort({ readyAt: -1 })   // newest served first
      .lean();

    // Enrich with computed metrics
    const enriched = orders.map(o => {
      const createdMs        = new Date(o.createdAt).getTime();
      const readyMs          = o.readyAt   ? new Date(o.readyAt).getTime()          : null;
      const cookingStartedMs = o.cookingStartedAt ? new Date(o.cookingStartedAt).getTime() : null;

      const prepDurationMs = readyMs   ? readyMs - createdMs               : null;
      const cookDurationMs = readyMs && cookingStartedMs ? readyMs - cookingStartedMs : null;
      const totalItems     = o.items.reduce((sum, item) => sum + item.quantity, 0);
      const slaBreached    = prepDurationMs !== null && prepDurationMs > 12 * 60 * 1000;

      return { ...o, prepDurationMs, cookDurationMs, totalItems, slaBreached };
    });

    const totalRevenue = enriched.length; // placeholder — orders served count
    const breachCount  = enriched.filter(o => o.slaBreached).length;
    const avgPrepMs    = enriched.length
      ? enriched.reduce((s, o) => s + (o.prepDurationMs ?? 0), 0) / enriched.length
      : 0;

    res.json({
      date:      startOfDay.toISOString().slice(0, 10),
      totalServed: enriched.length,
      breachCount,
      avgPrepMinutes: Math.round(avgPrepMs / 6000) / 10,
      orders:    enriched,
    });
  } catch (error) {
    next(error);
  }
});

