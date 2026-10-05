import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { inventoryService } from '../services/inventory.service.js';
import { paymentService } from '../services/payment.service.js';
import { mockDB } from '../simulation/mockDB.js';

const router = express.Router();

// Product catalogue with realistic skincare products
const products = [
  {
    id: 'GLOW-VITC-100',
    name: 'GlowShield Vitamin C 15% Brightening Serum',
    tagline: 'Triple-antioxidant flash formulation for radiant tone',
    category: 'Targeted Treatments',
    rating: 4.9,
    reviewsCount: 1420,
    price: 599,
    originalPrice: 899,
    discount: '33% OFF',
    isFlashSale: true,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    description: 'Our proprietary stabilized L-Ascorbic Acid + Ferulic Acid + Vitamin E complex. Penetrates deeper, neutralizing free radicals and fading stubborn hyperpigmentation.'
  },
  {
    id: 'GLOW-HA-02',
    name: 'HydroPlump Multi-Molecular Hyaluronic Acid',
    tagline: '5 molecular weights of hydration for instantaneous bounce',
    category: 'Hydration & Barrier',
    rating: 4.8,
    reviewsCount: 890,
    price: 499,
    originalPrice: 699,
    discount: '28% OFF',
    isFlashSale: false,
    image: 'https://images.unsplash.com/photo-1608248597359-20b17849cb15?auto=format&fit=crop&w=600&q=80',
    description: 'Instantly quenches dehydrated skin layers while creating a protective moisture matrix on the skin barrier.'
  },
  {
    id: 'GLOW-CER-03',
    name: 'Ceramide Barrier Recovery Velvet Cream',
    tagline: '3:1:1 physiological ratio of essential lipids',
    category: 'Moisturizers',
    rating: 4.9,
    reviewsCount: 650,
    price: 749,
    originalPrice: 999,
    discount: '25% OFF',
    isFlashSale: false,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    description: 'Repairs compromised skin barriers within 48 hours. Formulated with skin-identical ceramides NP, AP, and EOP.'
  },
  {
    id: 'GLOW-SPF-04',
    name: 'DewyShield Invisible Sunscreen Fluid SPF 50+ PA++++',
    tagline: 'Zero white cast, ultra-light weight water veil',
    category: 'Sun Protection',
    rating: 4.9,
    reviewsCount: 2130,
    price: 649,
    originalPrice: 799,
    discount: '18% OFF',
    isFlashSale: false,
    image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80',
    description: 'Hybrid UV filters blended with Centella Asiatica for soothing defense against UVA, UVB, and blue light.'
  },
  {
    id: 'GLOW-TON-05',
    name: 'Bio-Ferment Rosewater Balancing Essence Toner',
    tagline: 'Micro-exfoliating PHA with fermented Damascus rose',
    category: 'Toners & Essences',
    rating: 4.7,
    reviewsCount: 420,
    price: 429,
    originalPrice: 599,
    discount: '28% OFF',
    isFlashSale: false,
    image: 'https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?auto=format&fit=crop&w=600&q=80',
    description: 'Refines pore texture and balances pH without stripping hydration or disrupting microbial flora.'
  },
  {
    id: 'GLOW-CLN-06',
    name: 'Gentle Oat Milk Calming Jelly Cleanser',
    tagline: 'Sulfate-free lipid restoring daily face wash',
    category: 'Cleansers',
    rating: 4.8,
    reviewsCount: 910,
    price: 399,
    originalPrice: 499,
    discount: '20% OFF',
    isFlashSale: false,
    image: 'https://images.unsplash.com/photo-1556228722-d0b7194685ff?auto=format&fit=crop&w=600&q=80',
    description: 'Colloidal oatmeal and amino acid surfactants dissolve SPF and pollutants while preserving delicate lipid mantle.'
  }
];

// Get products catalog
router.get('/products', (req, res) => {
  const stock = mockDB.inventory;
  const list = products.map(p => {
    if (p.isFlashSale) {
      return {
        ...p,
        stockAvailable: stock.availableQuantity,
        stockReserved: stock.reservedQuantity,
        stockSold: stock.soldQuantity,
        totalStock: stock.initialStock
      };
    }
    return { ...p, stockAvailable: 500, stockReserved: 0, stockSold: 0, totalStock: 500 };
  });
  res.json({ products: list });
});

// Interactive StormShield Waiting Room Queue simulation
router.post('/queue/enter', (req, res) => {
  const queueNumber = Math.floor(Math.random() * 800) + 120;
  const waitSeconds = Math.max(3, Math.floor(queueNumber / 50));
  res.json({
    queueNumber,
    estimatedWaitSeconds: waitSeconds,
    status: 'IN_LINE'
  });
});

// Reserve inventory for user
router.post('/reserve', async (req, res) => {
  const { productId = 'GLOW-VITC-100', userId = `GUEST-${uuidv4().slice(0, 6)}`, quantity = 1, idempotencyKey } = req.body;
  const key = idempotencyKey || `SHOP-RES-${userId}-${productId}`;

  const result = await inventoryService.reserveInventory(productId, userId, quantity, key);
  if (!result.success) {
    return res.status(409).json({
      success: false,
      reason: result.reason || 'OUT_OF_STOCK',
      message: 'Product is sold out or unavailable.'
    });
  }

  res.json({
    success: true,
    reservation: result.reservation,
    isDuplicate: result.isDuplicate,
    expiresInSeconds: 300 // 5 minutes
  });
});

// Pay for reservation
router.post('/pay', async (req, res) => {
  let { reservationId, userId = `USER-${uuidv4().slice(0, 6)}`, amount = 599, method = 'UPI', idempotencyKey } = req.body;

  let activeRes = mockDB.reservations.get(reservationId);
  if (!activeRes) {
    const reserveResult = await inventoryService.reserveInventory('GLOW-VITC-100', userId, 1, `KEY-${userId}-${uuidv4().slice(0, 4)}`);
    if (reserveResult.success) {
      activeRes = reserveResult.reservation;
      reservationId = activeRes.reservationId;
    }
  }

  const key = idempotencyKey || `SHOP-PAY-${reservationId || uuidv4().slice(0, 6)}`;
  const outcome = 'SUCCESS';
  const paymentResult = await paymentService.processPayment(reservationId, userId, amount, key, outcome);

  if (!paymentResult.success) {
    return res.status(400).json({
      success: false,
      reason: paymentResult.reason || 'PAYMENT_FAILED',
      message: 'Payment processing could not be completed.'
    });
  }

  // Find order created
  const order = Array.from(mockDB.orders.values()).find(o => o.paymentId === paymentResult.payment?.paymentId);

  res.json({
    success: true,
    payment: paymentResult.payment,
    order: order || {
      orderId: `ORD-${uuidv4().slice(0, 6).toUpperCase()}`,
      status: 'CONFIRMED'
    }
  });
});

export default router;
