import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, index: true },
  initialStock: { type: Number, required: true },
  availableQuantity: { type: Number, required: true, min: 0 },
  reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
  soldQuantity: { type: Number, required: true, default: 0, min: 0 }
}, { timestamps: true });

export const Inventory = mongoose.model('Inventory', inventorySchema);
