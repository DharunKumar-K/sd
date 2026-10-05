import { inventoryService } from '../../services/inventory.service.js';
import { paymentService } from '../../services/payment.service.js';
import { v4 as uuidv4 } from 'uuid';
import { simulationEngine } from '../simulation.engine.js';

export const runFlashSaleScenario = async (users, stock, paymentSuccessRate, duplicateRate) => {
  const BATCH_SIZE = 50; // process 50 users concurrently to mimic StormShield admission
  const PRODUCT_ID = 'GLOW-VITC-100';
  
  let userIds = Array.from({ length: users }, (_, i) => `USER-${uuidv4()}`);
  
  // Mix in duplicate requests
  const numDuplicates = Math.floor(users * (duplicateRate / 100));
  for (let i = 0; i < numDuplicates; i++) {
    const randomExistingUser = userIds[Math.floor(Math.random() * userIds.length)];
    userIds.push(randomExistingUser);
  }

  // Shuffle
  userIds.sort(() => Math.random() - 0.5);

  const processUser = async (userId) => {
    try {
      // 1. Queue Backlog (StormShield simulation logic conceptually)
      simulationEngine.metrics.queueBacklog++;
      
      // We simulate admission processing speed (delay)
      await new Promise(r => setTimeout(r, Math.random() * 50));
      
      simulationEngine.metrics.queueBacklog--;

      // Use a consistent idempotency key per user for this flash sale
      const idempotencyKey = `RES-${userId}-${PRODUCT_ID}`;
      
      // 2. Reservation
      const reserveResult = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, idempotencyKey);
      
      if (!reserveResult.success) {
        return; // Out of stock or failed
      }
      
      // If duplicate reservation request, we shouldn't attempt payment again concurrently if already processed, 
      // but for simplicity we'll just skip duplicate payments or let payment idempotency handle it.
      
      // 3. Payment
      const paymentIdempotencyKey = `PAY-${userId}-${PRODUCT_ID}`;
      const outcomeRand = Math.random() * 100;
      let paymentOutcome = 'SUCCESS';
      if (outcomeRand > paymentSuccessRate) {
        // e.g. 95% success -> >95 is 5% failure
        paymentOutcome = 'FAIL';
      }

      await paymentService.processPayment(
        reserveResult.reservation.reservationId, 
        userId, 
        29.99, 
        paymentIdempotencyKey, 
        paymentOutcome
      );

    } catch (err) {
      console.error('Error processing simulated user:', err);
    }
  };

  // Process in batches
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    if (simulationEngine.status === 'STOPPED') break; // Early termination
    const batch = userIds.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(userId => processUser(userId)));
  }
};
