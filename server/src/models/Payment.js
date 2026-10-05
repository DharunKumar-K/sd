import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true, unique: true },
  reservationId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'RECONCILIATION'],
    default: 'INITIATED'
  },
  transactionReference: { type: String, unique: true, sparse: true }
}, { timestamps: true });

export const Payment = mongoose.model('Payment', paymentSchema);
