import { simulationEngine } from '../simulation/simulation.engine.js';
import { mockDB } from '../simulation/mockDB.js';

export class OrderService {
  constructor() {
    this.isDown = false;
  }

  setDowntime(isDown) {
    this.isDown = isDown;
  }

  async handlePaymentSucceeded(eventPayload) {
    if (this.isDown) {
      throw new Error('Order Service is temporarily DOWN');
    }

    const { paymentId, reservationId, userId, amount } = eventPayload;

    const existingOrder = Array.from(mockDB.orders.values()).find(o => o.paymentId === paymentId);
    if (existingOrder) return existingOrder; 

    const payment = mockDB.payments.get(paymentId);
    if (!payment) return null;

    const order = await mockDB.createOrder(payment);
    if (order) {
      simulationEngine.metrics.ordersCreated++;
    }

    return order;
  }
}

export const orderService = new OrderService();
