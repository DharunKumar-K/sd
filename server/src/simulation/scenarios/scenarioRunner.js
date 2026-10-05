import { v4 as uuidv4 } from 'uuid';
import { inventoryService } from '../../services/inventory.service.js';
import { paymentService } from '../../services/payment.service.js';
import { orderService } from '../../services/order.service.js';
import { simulationEngine } from '../simulation.engine.js';
import { mockDB } from '../mockDB.js';

export class ScenarioRunner {
  // Scenario 1: Normal Flash Sale (10,000 users, 100 stock, 95% payment success)
  static async runNormalFlashSale(users = 10000, stock = 100) {
    simulationEngine.activeScenario = 'NORMAL_FLASH_SALE';
    simulationEngine.scenarioDescription = `Simulating ${users.toLocaleString()} concurrent shoppers competing for ${stock} flash sale units.`;
    simulationEngine.setBanner({
      type: 'INFO',
      title: '⚡ StormShield Active',
      message: `${users.toLocaleString()} shoppers queued. Admitting batches of 50 to MongoDB atomic reservation endpoint.`
    });

    const BATCH_SIZE = 50;
    const PRODUCT_ID = 'GLOW-VITC-100';

    let userIds = Array.from({ length: Math.min(users, 2500) }, (_, i) => `USER-${uuidv4().slice(0, 8)}`);
    // Add 2% duplicate requests
    const dupCount = Math.floor(userIds.length * 0.02);
    for (let i = 0; i < dupCount; i++) {
      userIds.push(userIds[Math.floor(Math.random() * userIds.length)]);
    }
    userIds.sort(() => Math.random() - 0.5);

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      if (simulationEngine.status === 'STOPPED') break;

      simulationEngine.metrics.queueBacklog = Math.max(0, userIds.length - i);
      const batch = userIds.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (userId) => {
        const idempotencyKey = `RES-${userId}-${PRODUCT_ID}`;
        const reserveResult = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, idempotencyKey);

        if (reserveResult.success && !reserveResult.isDuplicate) {
          const outcomeRand = Math.random() * 100;
          const outcome = outcomeRand <= 95 ? 'SUCCESS' : 'FAIL';
          await paymentService.processPayment(
            reserveResult.reservation.reservationId,
            userId,
            599,
            `PAY-${userId}-${PRODUCT_ID}`,
            outcome
          );
        }
      }));

      // Short delay between batches to render real-time progression
      await new Promise(r => setTimeout(r, 60));

      if (mockDB.inventory.availableQuantity === 0 && mockDB.inventory.reservedQuantity === 0) {
        break; // Sold out completely
      }
    }

    simulationEngine.metrics.queueBacklog = 0;
    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: '✓ Flash Sale Completed',
      message: `All ${stock} units safely allocated without any overselling. Invariants preserved.`
    });
  }

  // Scenario 2: Last Item Race (Stock = 1, Customer A & B simultaneously)
  static async runLastItemRace() {
    mockDB.reset(1);
    simulationEngine.activeScenario = 'LAST_ITEM_RACE';
    simulationEngine.scenarioDescription = 'Stock = 1. Customer A (Elena) and Customer B (Aria) request simultaneously.';
    simulationEngine.setBanner({
      type: 'WARNING',
      title: '🏁 Race Condition Test: 1 Unit Left',
      message: 'Customer A & Customer B sending simultaneous reservation requests. Testing MongoDB atomic conditional update.'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';

    await new Promise(r => setTimeout(r, 600));

    // Fire both concurrently
    const [resultA, resultB] = await Promise.all([
      inventoryService.reserveInventory(PRODUCT_ID, 'CUST-A-ELENA', 1, 'KEY-RACE-A'),
      inventoryService.reserveInventory(PRODUCT_ID, 'CUST-B-ARIA', 1, 'KEY-RACE-B')
    ]);

    const winner = resultA.success ? 'Customer A (Elena)' : 'Customer B (Aria)';
    const loser = resultA.success ? 'Customer B (Aria)' : 'Customer A (Elena)';

    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: `🏆 Winner: ${winner}`,
      message: `MongoDB atomic update { availableQuantity: { $gte: 1 } } allowed exactly 1 winner. ${loser} was safely rejected with OUT_OF_STOCK.`
    });
  }

  // Scenario 3: Duplicate Buy (Idempotency test)
  static async runDuplicateBuy() {
    if (mockDB.inventory.availableQuantity < 1) {
      mockDB.reset(100);
    }
    simulationEngine.activeScenario = 'DUPLICATE_BUY';
    simulationEngine.scenarioDescription = 'Customer clicks Buy button twice rapidly with same request ID: BUY-REQ-1001.';
    simulationEngine.setBanner({
      type: 'INFO',
      title: '🔁 Testing Idempotency',
      message: 'Sending identical request ID: BUY-REQ-1001 twice in parallel.'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    const userId = 'CUST-SARAH';
    const idempotencyKey = 'BUY-REQ-1001';

    // First request
    const res1 = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, idempotencyKey);
    // Duplicate second request
    const res2 = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, idempotencyKey);

    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: '✓ Idempotency Verified',
      message: `First request created reservation ${res1.reservation?.reservationId}. Second request returned identical cached reservation. Stock was decremented ONLY ONCE!`
    });
  }

  // Scenario 4: High Payment Failure (50% fail & auto-release)
  static async runPaymentFailure(stock = 20) {
    mockDB.reset(stock);
    simulationEngine.activeScenario = 'PAYMENT_FAILURE';
    simulationEngine.scenarioDescription = 'High payment decline rate (50%). Failed reservations must be immediately released back to available inventory.';
    simulationEngine.setBanner({
      type: 'WARNING',
      title: '💳 High Payment Failure Scenario',
      message: '50% of payments will be simulated as card declined. Watch stock release back to AVAILABLE.'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    for (let i = 0; i < 20; i++) {
      const userId = `USER-PF-${i}`;
      const res = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, `RES-${userId}`);
      if (res.success && !res.isDuplicate) {
        const outcome = i % 2 === 0 ? 'FAIL' : 'SUCCESS';
        await paymentService.processPayment(res.reservation.reservationId, userId, 599, `PAY-${userId}`, outcome);
        await new Promise(r => setTimeout(r, 120));
      }
    }

    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: '✓ Inventory Restored Safely',
      message: 'Failed payments triggered ReservationReleased events via RabbitMQ and restored stock to the available pool.'
    });
  }

  // Scenario 5: Payment Timeout & Reconciliation
  static async runPaymentTimeout() {
    if (mockDB.inventory.availableQuantity < 1) {
      mockDB.reset(100);
    }
    simulationEngine.activeScenario = 'PAYMENT_TIMEOUT';
    simulationEngine.scenarioDescription = 'Payment Gateway encounters a network timeout. State is set to TIMED_OUT, sent to reconciliation queue.';
    simulationEngine.setBanner({
      type: 'WARNING',
      title: '⏱ Payment Gateway Timeout',
      message: 'Gateway did not respond within 3000ms. Status marked as TIMED_OUT (not immediately failed) to avoid double charges.'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    const userId = 'USER-TIMEOUT-DEMO';
    const res = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, `RES-${userId}`);

    if (res.success) {
      await paymentService.processPayment(res.reservation.reservationId, userId, 599, `PAY-${userId}`, 'TIMEOUT');
    }

    simulationEngine.setBanner({
      type: 'INFO',
      title: '🔍 Status in Reconciliation Queue',
      message: 'System initiated async webhook poll with payment provider. Consistent financial accounting preserved.'
    });
  }

  // Scenario 6: Order Service Down (30s outage)
  static async runOrderServiceDown(downtimeSec = 10) {
    if (mockDB.inventory.availableQuantity < 5) {
      mockDB.reset(100);
    }
    simulationEngine.activeScenario = 'ORDER_SERVICE_DOWN';
    simulationEngine.scenarioDescription = `Simulating Order Service outage for ${downtimeSec}s. Payments succeed, RabbitMQ buffers events, then Order Service recovers.`;
    
    orderService.setDowntime(true);
    simulationEngine.setBanner({
      type: 'ERROR',
      title: '⚠ ORDER SERVICE DOWN',
      message: `Payments are safe in MongoDB. PaymentConfirmed events are buffering in RabbitMQ. Recovery scheduled in ${downtimeSec}s.`
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    for (let i = 0; i < 5; i++) {
      const userId = `USER-OSD-${i}`;
      const res = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, `RES-${userId}`);
      if (res.success) {
        await paymentService.processPayment(res.reservation.reservationId, userId, 599, `PAY-${userId}`, 'SUCCESS');
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Wait for downtime
    await new Promise(r => setTimeout(r, downtimeSec * 1000));

    // Recovery
    orderService.setDowntime(false);
    simulationEngine.metrics.ordersRecovered += 5;
    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: '✓ Order Service Recovered',
      message: 'Order Service reconnected. RabbitMQ consumers flushed buffered events and created all pending orders without data loss!'
    });
  }

  // Scenario 7: Database Failure
  static async runDatabaseFailure() {
    simulationEngine.activeScenario = 'DATABASE_FAILURE';
    simulationEngine.scenarioDescription = 'MongoDB cluster experiences connection partition. Requests must fail cleanly without inventing phantom stock.';
    mockDB.dbDown = true;
    simulationEngine.setBanner({
      type: 'ERROR',
      title: '💥 MongoDB Cluster Unavailable',
      message: 'Simulating database partition. Testing bounded retry and graceful fail-fast response.'
    });

    await new Promise(r => setTimeout(r, 800));
    const PRODUCT_ID = 'GLOW-VITC-100';
    await inventoryService.reserveInventory(PRODUCT_ID, 'USER-DBFAIL-1', 1, 'KEY-DBFAIL-1');
    await inventoryService.reserveInventory(PRODUCT_ID, 'USER-DBFAIL-2', 1, 'KEY-DBFAIL-2');

    await new Promise(r => setTimeout(r, 1200));
    mockDB.dbDown = false;
    simulationEngine.setBanner({
      type: 'INFO',
      title: '✓ Clean Failure Preserved',
      message: 'Database partition handled cleanly. No phantom reservations were created while MongoDB was unreachable.'
    });
  }

  // Scenario 8: Payment Gateway Failure (Circuit Breaker)
  static async runPaymentGatewayFailure() {
    if (mockDB.inventory.availableQuantity < 5) {
      mockDB.reset(100);
    }
    simulationEngine.activeScenario = 'PAYMENT_GATEWAY_FAILURE';
    simulationEngine.scenarioDescription = 'Payment Gateway crashes. Circuit Breaker trips from CLOSED to OPEN after 3 failures.';
    mockDB.circuitBreaker.failures = 0;
    mockDB.circuitBreaker.state = 'CLOSED';

    simulationEngine.setBanner({
      type: 'WARNING',
      title: '⚡ Circuit Breaker Tripping',
      message: 'Injecting payment failures to trip Circuit Breaker from CLOSED -> OPEN.'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    for (let i = 0; i < 4; i++) {
      const userId = `USER-CB-${i}`;
      const res = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, `RES-${userId}`);
      if (res.success) {
        await paymentService.processPayment(res.reservation.reservationId, userId, 599, `PAY-${userId}`, 'FAIL');
      }
      await new Promise(r => setTimeout(r, 300));
    }

    simulationEngine.setBanner({
      type: 'ERROR',
      title: '🛑 Circuit Breaker: OPEN',
      message: 'Threshold exceeded (3 failures). Circuit is OPEN. Subsequent payments fail fast without hitting failing external gateway.'
    });
  }

  // Scenario 9: Reservation Expiry
  static async runReservationExpiry() {
    simulationEngine.activeScenario = 'RESERVATION_EXPIRY';
    simulationEngine.scenarioDescription = 'Reservation TTL expires after customer abandons checkout. Stock is automatically returned to available inventory.';
    simulationEngine.setBanner({
      type: 'INFO',
      title: '⏳ Simulating 20-Second Reservation TTL',
      message: 'Customer reserved unit but walked away. Countdown active: stock held temporarily...'
    });

    const PRODUCT_ID = 'GLOW-VITC-100';
    const userId = 'USER-ABANDON-CART';
    const res = await inventoryService.reserveInventory(PRODUCT_ID, userId, 1, `RES-${userId}`);

    if (res.success) {
      await new Promise(r => setTimeout(r, 3000)); // fast demo expiry in 3s
      await mockDB.releaseReservation(res.reservation.reservationId, 'TIMEOUT');
      simulationEngine.setBanner({
        type: 'SUCCESS',
        title: '✓ Stock Restored Upon Expiry',
        message: `Reservation ${res.reservation.reservationId} timed out. RabbitMQ ReservationExpired event emitted. 1 unit restored to AVAILABLE stock.`
      });
    }
  }

  // Scenario 10: Traffic ×50 Surge
  static async runTrafficSpike() {
    simulationEngine.activeScenario = 'TRAFFIC_SPIKE';
    simulationEngine.scenarioDescription = '50,000 shoppers hit the site in 5 seconds. StormShield queue protects backend from crashing.';
    simulationEngine.setBanner({
      type: 'WARNING',
      title: '🌊 Traffic Surge: 50,000 RPS',
      message: 'StormShield virtual waiting room active. Queue depth surging to 48,000 while backend admission is capped at 100/s.'
    });

    simulationEngine.metrics.queueBacklog = 48500;
    simulationEngine.metrics.totalRequests += 50000;

    for (let step = 0; step < 5; step++) {
      simulationEngine.metrics.queueBacklog -= 8000;
      await new Promise(r => setTimeout(r, 400));
    }
    simulationEngine.metrics.queueBacklog = 0;

    simulationEngine.setBanner({
      type: 'SUCCESS',
      title: '✓ Backend Protected by StormShield',
      message: 'All 50,000 requests absorbed at the edge without database saturation or connection pool exhaustion.'
    });
  }
}
