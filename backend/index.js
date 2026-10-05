const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory data store
let products = [
  {
    id: 'prod_1',
    name: 'Radiance C-Serum',
    description: 'Clinically proven to brighten and firm. 15% pure L-ascorbic acid.',
    price: 2999,
    originalPrice: 5999,
    stock: 100,
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'prod_2',
    name: 'Hydration Boost Moisturizer',
    description: 'Deep hydration with hyaluronic acid and ceramides. 48-hour moisture lock.',
    price: 1499,
    originalPrice: 2499,
    stock: 50,
    imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=800'
  },
  {
    id: 'prod_3',
    name: 'Purifying Clay Mask',
    description: 'Detoxifies pores with kaolin clay and green tea extract.',
    price: 999,
    originalPrice: 1599,
    stock: 0,
    imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800'
  }
];

// In-memory queue state
const activeQueues = {};

// 1. Get all products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// 2. Enter StormShield Queue
app.post('/api/stormshield/enter', (req, res) => {
  const { productId } = req.body;
  const product = products.find(p => p.id === productId);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.stock <= 0) {
    return res.json({ status: 'sold_out', message: 'Currently Sold Out' });
  }

  const queueId = 'queue_' + Math.random().toString(36).substr(2, 9);
  
  // Simulate initial queue position based on random load
  const position = Math.floor(Math.random() * 200) + 50; 
  
  activeQueues[queueId] = {
    productId,
    position,
    status: 'queued',
    lastUpdated: Date.now()
  };

  res.json({
    queueId,
    status: 'queued',
    position,
    estimatedWaitSeconds: Math.ceil(position / 50) * 3
  });
});

// 3. Poll Queue Status
app.get('/api/stormshield/status/:queueId', (req, res) => {
  const { queueId } = req.params;
  const queueEntry = activeQueues[queueId];

  if (!queueEntry) {
    return res.status(404).json({ error: 'Queue entry not found' });
  }

  if (queueEntry.status !== 'queued') {
    return res.json(queueEntry);
  }

  // Simulate queue moving over time
  const now = Date.now();
  const timeDiffSeconds = (now - queueEntry.lastUpdated) / 1000;
  
  if (timeDiffSeconds >= 2) {
    // Drop position by ~30 per 2 seconds
    queueEntry.position -= Math.floor(Math.random() * 20) + 20;
    queueEntry.lastUpdated = now;

    if (queueEntry.position <= 0) {
      queueEntry.position = 0;
      
      // Try to reserve inventory
      const product = products.find(p => p.id === queueEntry.productId);
      if (product && product.stock > 0) {
        product.stock -= 1; // Atomic decrement in memory
        queueEntry.status = 'reserved';
        queueEntry.admissionToken = 'jwt_' + Math.random().toString(36).substr(2, 9);
      } else {
        queueEntry.status = 'sold_out';
      }
    }
  }

  res.json({
    status: queueEntry.status,
    position: queueEntry.position,
    estimatedWaitSeconds: Math.ceil(queueEntry.position / 50) * 3,
    admissionToken: queueEntry.admissionToken
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Dummy Backend running on http://localhost:${PORT}`);
});
