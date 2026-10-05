const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 5 categories x 2 products each
let products = [
  // Serums
  { id: 'prod_1', category: 'Serums', name: 'Radiance C-Serum', description: '15% pure L-ascorbic acid for instant brightening.', price: 2999, originalPrice: 5999, stock: 100, imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800' },
  { id: 'prod_2', category: 'Serums', name: 'Hyaluronic Acid 2% + B5', description: 'Deep hydration formula for plump, dewy skin.', price: 1299, originalPrice: 2299, stock: 50, imageUrl: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&q=80&w=800' },
  
  // Moisturizers
  { id: 'prod_3', category: 'Moisturizers', name: 'Barrier Repair Cream', description: 'Ceramide-rich rich cream to repair damaged skin barriers.', price: 1899, originalPrice: 2899, stock: 20, imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=800' },
  { id: 'prod_4', category: 'Moisturizers', name: 'Aqua Gel Moisturizer', description: 'Oil-free, lightweight gel for oily and acne-prone skin.', price: 1499, originalPrice: 2499, stock: 0, imageUrl: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&q=80&w=800' },
  
  // Cleansers
  { id: 'prod_5', category: 'Cleansers', name: 'Gentle Oat Cleanser', description: 'Non-stripping face wash for sensitive skin.', price: 999, originalPrice: 1599, stock: 200, imageUrl: 'https://images.unsplash.com/photo-1556228720-192a6af4e865?auto=format&fit=crop&q=80&w=800' },
  { id: 'prod_6', category: 'Cleansers', name: 'Salicylic Acid Foaming Wash', description: '2% BHA to clear pores and prevent breakouts.', price: 1199, originalPrice: 1799, stock: 75, imageUrl: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800' },
  
  // Masks
  { id: 'prod_7', category: 'Masks', name: 'Purifying Clay Mask', description: 'Kaolin and Bentonite clay to absorb excess oil.', price: 1599, originalPrice: 2199, stock: 0, imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800' },
  { id: 'prod_8', category: 'Masks', name: 'Soothing Aloe Gel Mask', description: 'Cooling relief for irritated or sunburned skin.', price: 1299, originalPrice: 1899, stock: 150, imageUrl: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&q=80&w=800' },

  // Sunscreens
  { id: 'prod_9', category: 'Sunscreens', name: 'Invisible Finish SPF 50', description: 'Zero white cast, broad-spectrum UVA/UVB protection.', price: 1699, originalPrice: 2599, stock: 300, imageUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&q=80&w=800' },
  { id: 'prod_10', category: 'Sunscreens', name: 'Mineral Zinc Shield SPF 30', description: '100% mineral sunscreen for the most sensitive skin types.', price: 1999, originalPrice: 2999, stock: 10, imageUrl: 'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&q=80&w=800' }
];

const activeQueues = {};

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/stormshield/enter', (req, res) => {
  const { productId } = req.body;
  const product = products.find(p => p.id === productId);

  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock <= 0) return res.json({ status: 'sold_out', message: 'Currently Sold Out' });

  const queueId = 'queue_' + Math.random().toString(36).substr(2, 9);
  const position = Math.floor(Math.random() * 100) + 10; // Start at 10 to 110 to make it faster to test
  
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

app.get('/api/stormshield/status/:queueId', (req, res) => {
  const { queueId } = req.params;
  const queueEntry = activeQueues[queueId];

  if (!queueEntry) return res.status(404).json({ error: 'Queue entry not found' });

  if (queueEntry.status !== 'queued') {
    return res.json(queueEntry);
  }

  const now = Date.now();
  const timeDiffSeconds = (now - queueEntry.lastUpdated) / 1000;
  
  if (timeDiffSeconds >= 1.5) { // Fast forward queue every 1.5 seconds
    queueEntry.position -= Math.floor(Math.random() * 15) + 10;
    queueEntry.lastUpdated = now;

    if (queueEntry.position <= 0) {
      queueEntry.position = 0;
      
      const product = products.find(p => p.id === queueEntry.productId);
      if (product && product.stock > 0) {
        product.stock -= 1; 
        queueEntry.status = 'reserved';
        queueEntry.admissionToken = 'jwt_' + Math.random().toString(36).substr(2, 9);
      } else {
        queueEntry.status = 'sold_out';
      }
    }
  }

  res.json({
    status: queueEntry.status,
    position: queueEntry.position > 0 ? queueEntry.position : 0,
    estimatedWaitSeconds: Math.max(0, Math.ceil(queueEntry.position / 50) * 3),
    admissionToken: queueEntry.admissionToken || null
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Dummy Backend running on http://localhost:${PORT}`);
});
