// shared/socket/events.ts - vendored from monorepo shared package
export const EVENTS = {
  ORDER_RECEIVED:    'order:received',
  STATUS_UPDATED:    'order:status_updated',
  ORDER_COMPLETED:   'order:completed',
  CONNECT_KITCHEN:   'kitchen:connect',
  INVENTORY_ALERT:   'inventory:alert',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];
