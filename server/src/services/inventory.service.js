import { v4 as uuidv4 } from 'uuid';
import { simulationEngine } from '../simulation/simulation.engine.js';
import { mockDB } from '../simulation/mockDB.js';

export class InventoryService {
  async reserveInventory(productId, userId, quantity, idempotencyKey) {
    simulationEngine.metrics.totalRequests++;

    const existingReservation = Array.from(mockDB.reservations.values()).find(r => r.idempotencyKey === idempotencyKey);
    if (existingReservation) {
      simulationEngine.metrics.duplicateRequests++;
      mockDB.duplicateReservationsBlocked++;
      mockDB.emitEvent('DuplicateReservationDetected', 'InventoryService', idempotencyKey, { existingReservationId: existingReservation.reservationId }, 'IDEMPOTENT_HIT');
      return { success: true, reservation: existingReservation, isDuplicate: true };
    }

    const updateResult = await mockDB.reserveAtomic(productId, userId, quantity, idempotencyKey);

    if (!updateResult.success) {
      simulationEngine.metrics.outOfStock++;
      simulationEngine.metrics.reservationFailures++;
      return { success: false, reason: 'OUT_OF_STOCK' };
    }

    simulationEngine.metrics.successfulReservations++;
    simulationEngine.metrics.uniqueReservations++;

    return { success: true, reservation: updateResult.reservation, isDuplicate: false };
  }

  async releaseReservation(reservationId) {
    const reservation = mockDB.reservations.get(reservationId);
    if (!reservation || reservation.status !== 'RESERVED') {
      return { success: false };
    }

    reservation.status = 'RELEASED';
    mockDB.inventory.availableQuantity += reservation.quantity;
    mockDB.inventory.reservedQuantity -= reservation.quantity;
    
    simulationEngine.metrics.reservationsReleased++;
    return { success: true };
  }
}

export const inventoryService = new InventoryService();
