import { OrderStatus } from '../../../shared/types';

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  received: ['cooking'],
  cooking: ['ready'],
  ready: ['served'],
  served: [], // Terminal state
};

export function validateTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_FLOW[from].includes(to);
}
