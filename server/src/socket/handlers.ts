import { Server, Socket } from 'socket.io';
import { EVENTS } from '../../../shared/socket/events';
import { OrderModel } from '../models/Order';
import { validateTransition } from '../utils/statusGuard';
import { sendOrderSms } from '../services/sms';
import { depleteInventory } from '../services/inventoryDepletion';

export function registerSocketHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.CONNECT_KITCHEN, async () => {
    try {
      const activeOrders = await OrderModel
        .find({ status: { $in: ['received', 'cooking'] } })
        .sort({ createdAt: 1 })
        .lean();
      socket.emit('kitchen:hydrate', activeOrders);
    } catch (err) {
      socket.emit('error', { message: 'Failed to hydrate kitchen display' });
    }
  });

  socket.on(EVENTS.STATUS_UPDATED, async (payload: unknown) => {
    try {
      // Basic runtime check
      if (!payload || typeof payload !== 'object') {
        return socket.emit('error', { message: 'Invalid payload' });
      }
      const { orderId, newStatus } = payload as { orderId: string; newStatus: any };

      if (!orderId || !newStatus) {
        return socket.emit('error', { message: 'Missing orderId or newStatus' });
      }

      const order = await OrderModel.findById(orderId).lean();
      if (!order) return socket.emit('error', { message: 'Order not found' });

      if (!validateTransition(order.status, newStatus)) {
        return socket.emit('error', { message: `Invalid transition: ${order.status} -> ${newStatus}` });
      }

      const updateData: any = { status: newStatus };
      if (newStatus === 'cooking') {
        updateData.cookingStartedAt = new Date();
      } else if (newStatus === 'ready') {
        updateData.readyAt = new Date();
      }

      const updated = await OrderModel
        .findByIdAndUpdate(orderId, updateData, { new: true })
        .lean();

      if (!updated) {
          return socket.emit('error', { message: 'Failed to update order' });
      }

      if (updated.phone) {
        if (newStatus === 'cooking') {
          await sendOrderSms(updated.phone, `The chef has started preparing your order for Table ${updated.tableNumber}! 🍳`);
        } else if (newStatus === 'ready') {
          await sendOrderSms(updated.phone, `Order Up! Your meal is hot and ready for pickup at the counter! 🍔✨`);
        }
      }

      // Fire-and-forget inventory depletion on received → cooking
      if (newStatus === 'cooking' && updated.items?.length) {
        depleteInventory(io, updated.items as any).catch(() => {
          // Errors logged inside service — never surface to client
        });
      }

      io.emit(EVENTS.STATUS_UPDATED, updated);

      if (newStatus === 'ready') {
        io.emit(EVENTS.ORDER_COMPLETED, updated);
      }
    } catch (err) {
      socket.emit('error', { message: 'Internal server error processing status update' });
    }
  });
}
