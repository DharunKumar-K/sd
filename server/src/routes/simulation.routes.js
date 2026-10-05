import express from 'express';
import { simulationEngine } from '../simulation/simulation.engine.js';
import { ScenarioRunner } from '../simulation/scenarios/scenarioRunner.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  const status = await simulationEngine.getStatus();
  res.json(status);
});

router.post('/reset', async (req, res) => {
  const { stock = 100 } = req.body;
  await simulationEngine.reset(stock);
  res.json({ message: 'Simulation reset successful', stock });
});

router.post('/start', async (req, res) => {
  const { scenario = 'normal', users = 10000, stock = 100 } = req.body;

  if (simulationEngine.status === 'RUNNING') {
    return res.status(400).json({ error: 'Simulation is currently running' });
  }

  simulationEngine.status = 'RUNNING';

  const runTask = async () => {
    try {
      switch (scenario) {
        case 'normal':
          await ScenarioRunner.runNormalFlashSale(users, stock);
          break;
        case 'race':
          await ScenarioRunner.runLastItemRace();
          break;
        case 'duplicate':
          await ScenarioRunner.runDuplicateBuy();
          break;
        case 'payment-failure':
          await ScenarioRunner.runPaymentFailure();
          break;
        case 'payment-timeout':
          await ScenarioRunner.runPaymentTimeout();
          break;
        case 'order-down':
          await ScenarioRunner.runOrderServiceDown(10);
          break;
        case 'db-failure':
          await ScenarioRunner.runDatabaseFailure();
          break;
        case 'gateway-failure':
          await ScenarioRunner.runPaymentGatewayFailure();
          break;
        case 'expiry':
          await ScenarioRunner.runReservationExpiry();
          break;
        case 'spike':
          await ScenarioRunner.runTrafficSpike();
          break;
        default:
          await ScenarioRunner.runNormalFlashSale(users, stock);
      }
    } catch (err) {
      console.error('Scenario execution error:', err);
    } finally {
      simulationEngine.status = 'STOPPED';
    }
  };

  runTask();
  res.json({ message: `Scenario ${scenario} started` });
});

export default router;
