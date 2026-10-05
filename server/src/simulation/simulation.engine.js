import { v4 as uuidv4 } from 'uuid';
import { mockDB } from './mockDB.js';

export class SimulationEngine {
  constructor() {
    this.status = 'STOPPED'; // STOPPED, RUNNING, PAUSED
    this.activeScenario = 'IDLE';
    this.scenarioDescription = 'System is ready for flash sale simulation';
    this.banner = null;
    this.metrics = {
      totalRequests: 0,
      successfulReservations: 0,
      reservationFailures: 0,
      outOfStock: 0,
      duplicateRequests: 0,
      uniqueReservations: 0,
      paymentsStarted: 0,
      paymentsSucceeded: 0,
      paymentsFailed: 0,
      paymentsTimedOut: 0,
      ordersCreated: 0,
      ordersRecovered: 0,
      reservationsReleased: 0,
      queueBacklog: 0,
      averageReservationLatencyMs: 24,
      averagePaymentLatencyMs: 65,
      averageRecoveryTimeMs: 0
    };
  }

  async reset(stock = 100) {
    mockDB.reset(stock);
    this.status = 'STOPPED';
    this.activeScenario = 'IDLE';
    this.scenarioDescription = 'System reset. Ready for new scenario.';
    this.banner = null;
    
    this.metrics = {
      totalRequests: 0,
      successfulReservations: 0,
      reservationFailures: 0,
      outOfStock: 0,
      duplicateRequests: 0,
      uniqueReservations: 0,
      paymentsStarted: 0,
      paymentsSucceeded: 0,
      paymentsFailed: 0,
      paymentsTimedOut: 0,
      ordersCreated: 0,
      ordersRecovered: 0,
      reservationsReleased: 0,
      queueBacklog: 0,
      averageReservationLatencyMs: 24,
      averagePaymentLatencyMs: 65,
      averageRecoveryTimeMs: 0
    };
  }

  setBanner(banner) {
    this.banner = banner;
  }

  async getStatus() {
    const inventory = mockDB.inventory;
    const invariants = mockDB.getInvariants();

    return {
      status: this.status,
      activeScenario: this.activeScenario,
      scenarioDescription: this.scenarioDescription,
      banner: this.banner,
      circuitBreaker: mockDB.circuitBreaker,
      dbStatus: mockDB.dbDown ? 'DOWN' : 'HEALTHY',
      infrastructure: 'DEMO SIMULATION MODE (MongoDB & Redis In-Memory Fallback)',
      metrics: {
        ...this.metrics,
        duplicateReservationsBlocked: mockDB.duplicateReservationsBlocked,
        duplicatePaymentsBlocked: mockDB.duplicatePaymentsBlocked
      },
      inventory: inventory ? {
        available: inventory.availableQuantity,
        reserved: inventory.reservedQuantity,
        sold: inventory.soldQuantity,
        total: inventory.initialStock
      } : null,
      events: mockDB.events.slice(0, 35),
      invariants
    };
  }
}

export const simulationEngine = new SimulationEngine();
