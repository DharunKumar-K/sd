import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, unique: true }, // Duplicate protection
  productId: { type: String, required: true },
  userId: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  status: { 
    type: String, 
    enum: ['RESERVED', 'PAYMENT_PENDING', 'CONFIRMED', 'PAYMENT_FAILED', 'RELEASED', 'SOLD'],
    default: 'RESERVED' 
  },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

reservationSchema.index({ status: 1, expiresAt: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema);
