import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { EVENTS } from '../../../shared/socket/events';
import type { Order } from '../../../shared/types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [inventoryAlert, setInventoryAlert] = useState<string | null>(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      socket.emit(EVENTS.CONNECT_KITCHEN);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    // Hydrate state on first connect / reconnect
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Initial check just in case we missed the connect event
    if (socket.connected) {
      onConnect();
    }

    socket.on('kitchen:hydrate', (hydrated: Order[]) => {
      setOrders(hydrated);
    });

    socket.on(EVENTS.ORDER_RECEIVED, (order: Order) => {
      setOrders(prev => {
        // Prevent duplicates
        if (prev.some(o => o._id === order._id)) return prev;
        return [...prev, order];
      });
    });

    socket.on(EVENTS.STATUS_UPDATED, (updated: Order) => {
      setOrders(prev =>
        prev.map(o => o._id === updated._id ? updated : o)
      );
    });

    socket.on(EVENTS.ORDER_COMPLETED, (_completed: Order) => {
      // No auto-purge. The ticket migrates to the Completed Log panel and
      // remains there until explicitly archived to 'served' via bump bar / button.
      // STATUS_UPDATED already handles the in-place state mutation above.
    });

    socket.on(EVENTS.INVENTORY_ALERT, (payload: { message: string }) => {
      setInventoryAlert(payload.message);
      // Auto-clear after 30 seconds so the banner doesn't persist forever
      setTimeout(() => setInventoryAlert(null), 30000);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('kitchen:hydrate');
      socket.off(EVENTS.ORDER_RECEIVED);
      socket.off(EVENTS.STATUS_UPDATED);
      socket.off(EVENTS.ORDER_COMPLETED);
      socket.off(EVENTS.INVENTORY_ALERT);
    };
  }, []);

  const updateStatus = useCallback((orderId: string, newStatus: Order['status']) => {
    // Only emit, no optimistic UI! Server response will update the list via STATUS_UPDATED event
    socket.emit(EVENTS.STATUS_UPDATED, { orderId, newStatus });
  }, []);

  return { orders, updateStatus, isConnected, inventoryAlert };
}
