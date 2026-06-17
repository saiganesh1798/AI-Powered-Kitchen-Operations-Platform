import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrderModel } from '../models/Order';
import { validateTransition } from '../utils/statusGuard';
import { getIO } from '../socket'; // Need to create a way to get io instance
import { EVENTS } from '../../../shared/socket/events';
import { sendOrderSms } from '../services/sms';

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
