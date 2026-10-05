import { mockDB } from '../simulation/mockDB.js';
import { v4 as uuidv4 } from 'uuid';
import { simulationEngine } from '../simulation/simulation.engine.js';
import { orderService } from './order.service.js';

export class PaymentService {
  async processPayment(reservationId, userId, amount, idempotencyKey, simulateOutcome) {
    simulationEngine.metrics.paymentsStarted++;

    const existingPayment = Array.from(mockDB.payments.values()).find(p => p.idempotencyKey === idempotencyKey);
    if (existingPayment) {
      mockDB.duplicatePaymentsBlocked++;
      mockDB.emitEvent('DuplicatePaymentDetected', 'PaymentService', idempotencyKey, { paymentId: existingPayment.paymentId }, 'IDEMPOTENT_HIT');
      return { success: existingPayment.status === 'SUCCEEDED', payment: existingPayment };
    }

    let status = 'SUCCEEDED';
    if (simulateOutcome === 'FAIL') status = 'FAILED';
    if (simulateOutcome === 'TIMEOUT') status = 'TIMED_OUT';

    const payment = await mockDB.createPayment(reservationId, userId, amount, idempotencyKey, status);

    if (status === 'SUCCEEDED') {
      simulationEngine.metrics.paymentsSucceeded++;
      
      // Simulate Event Publishing -> RabbitMQ -> Worker -> OrderService
      // Using direct call for in-memory demo mode
      setTimeout(() => {
        orderService.handlePaymentSucceeded({
          paymentId: payment.paymentId,
          reservationId: payment.reservationId,
          userId: payment.userId,
          amount: payment.amount
        }).catch(err => {
          if (err.message === 'Order Service is temporarily DOWN') {
             // Mock retry logic
             setTimeout(() => {
               orderService.handlePaymentSucceeded({
                 paymentId: payment.paymentId,
                 reservationId: payment.reservationId,
                 userId: payment.userId,
                 amount: payment.amount
               }).catch(e => console.error(e));
             }, 31000); // retry after 31s
          }
        });
      }, 50);

      return { success: true, payment };
    } else if (status === 'FAILED') {
      simulationEngine.metrics.paymentsFailed++;
      // Release reservation
      // In real life via event, here we do it directly for mock
      import('./inventory.service.js').then(module => {
        module.inventoryService.releaseReservation(reservationId);
      });
      return { success: false, payment };
    } else {
      simulationEngine.metrics.paymentsTimedOut++;
      return { success: false, reason: 'TIMEOUT', payment };
    }
  }
}

export const paymentService = new PaymentService();
