import { getChannel } from '../events/publisher.js';
import { orderService } from '../services/order.service.js';
import { simulationEngine } from '../simulation/simulation.engine.js';

export const startOrderWorker = async () => {
  const channel = getChannel();
  if (!channel) return;

  const q = await channel.assertQueue('order_creation_queue', { durable: true });
  await channel.bindQueue(q.queue, 'glowrush_events', 'payment.succeeded');

  channel.consume(q.queue, async (msg) => {
    if (msg !== null) {
      try {
        const event = JSON.parse(msg.content.toString());
        await orderService.handlePaymentSucceeded(event.payload);
        channel.ack(msg);
      } catch (error) {
        if (error.message === 'Order Service is temporarily DOWN') {
          // Requeue or wait
          console.log('[Worker] Order service down, requeuing message');
          setTimeout(() => channel.nack(msg, false, true), 1000); // Requeue after delay
        } else {
          console.error('[Worker] Order creation failed permanently', error);
          // Dead letter queue would go here
          channel.nack(msg, false, false);
        }
      }
    }
  });
};
