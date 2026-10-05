import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, unique: true },
  reservationId: { type: String, required: true, unique: true },
  paymentId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  productId: { type: String, required: true },
  quantity: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'],
    default: 'CREATED'
  }
}, { timestamps: true });

export const Order = mongoose.model('Order', orderSchema);
