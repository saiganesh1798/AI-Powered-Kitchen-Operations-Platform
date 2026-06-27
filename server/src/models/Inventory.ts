import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryItem {
  ingredientName: string;   // Normalized to lowercase for matching
  stockLevel: number;        // Units remaining
  criticalThreshold: number; // Below this → emit INVENTORY_ALERT
  unit: string;              // e.g. 'patties', 'portions', 'kg'
  updatedAt?: Date;
}

const InventorySchema = new Schema<IInventoryItem & Document>(
  {
    ingredientName:   { type: String, required: true, unique: true, lowercase: true, trim: true },
    stockLevel:       { type: Number, required: true, min: 0 },
    criticalThreshold:{ type: Number, required: true, default: 5 },
    unit:             { type: String, required: true, trim: true, default: 'portions' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const InventoryModel = mongoose.model<IInventoryItem & Document>('Inventory', InventorySchema);
