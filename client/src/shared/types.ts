// shared/types.ts - vendored from monorepo shared package
export type OrderStatus  = 'received' | 'cooking' | 'ready' | 'served';
export type KitchenStation = 'grill' | 'fry' | 'prep' | 'assembly';
export type StationFilter  = 'all' | KitchenStation;

export interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
  /** Routing station this item is prepared at */
  station?: KitchenStation;
}

export interface Order {
  _id: string;
  tableNumber: number;
  items: OrderItem[];
  status: OrderStatus;
  phone?: string;
  cookingStartedAt?: string;
  readyAt?: string;
  createdAt: string;  // ISO string from MongoDB
  updatedAt: string;
}
