import express from 'express';
import cors from 'cors';
import simulationRoutes from './routes/simulation.routes.js';
import shopRoutes from './routes/shop.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => res.json({ 
  status: 'READY', 
  platform: 'GlowRush High-Scale Skincare Flash Sale Engine',
  infrastructure: ['MongoDB (Simulated Atomic Semantics)', 'Redis Cache/Queue', 'RabbitMQ Event Bus'] 
}));

app.use('/api/simulation', simulationRoutes);
app.use('/api/shop', shopRoutes);

export default app;
