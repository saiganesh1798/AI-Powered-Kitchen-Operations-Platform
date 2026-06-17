import mongoose, { Schema, Document } from 'mongoose';
import { Order, OrderStatus } from '../../../shared/types';

const ORDER_STATUSES: OrderStatus[] = ['received', 'cooking', 'ready', 'served'];

const OrderSchema = new Schema<Order & Document>(
  {
    tableNumber: { type: Number, required: true, min: 1 },
    items: [
      {
        name:     { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        notes:    { type: String, trim: true },
        station:  { type: String, enum: ['grill', 'fry', 'prep', 'assembly'], default: 'assembly' },
      },
    ],
    phone: { type: String, trim: true },
    cookingStartedAt: { type: Date },
    readyAt: { type: Date },
    status: {
      type:    String,
      enum:    ORDER_STATUSES,
      default: 'received',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

OrderSchema.index({ status: 1, createdAt: 1 });

export const OrderModel = mongoose.model<Order & Document>('Order', OrderSchema);
