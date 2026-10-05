import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import CustomerStore from './components/CustomerStore';
import EngineeringCenter from './components/EngineeringCenter';
import WaitingRoomModal from './components/WaitingRoomModal';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import ArchitectureLabModal from './components/ArchitectureLabModal';
import ProductDetailModal from './components/ProductDetailModal';
import OrderTrackingModal from './components/OrderTrackingModal';

// Skincare products fallback
const DEFAULT_PRODUCTS = [
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
    description: 'Proprietary stabilized 15% L-Ascorbic Acid + Ferulic Acid + Vitamin E complex. Penetrates deeper, neutralizing free radicals and fading stubborn hyperpigmentation.'
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

export default function App() {
  const [activeTab, setActiveTab] = useState('store'); // 'store' or 'engineering'
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [cartItems, setCartItems] = useState([
    { ...DEFAULT_PRODUCTS[0], quantity: 1 }
  ]);
  const [wishlist, setWishlist] = useState(['GLOW-VITC-100']);
  const [hasReservation, setHasReservation] = useState(true);

  // Modals state
  const [isWaitingRoomOpen, setIsWaitingRoomOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isArchLabOpen, setIsArchLabOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [orderTrackingData, setOrderTrackingData] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Polling simulation status
  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/simulation/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch simulation status:', err);
    }
  };

  // Fetch shop catalog
  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/shop/products');
      if (res.data?.products) {
        setProducts(res.data.products);
      }
    } catch (err) {
      // Keep defaults
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchProducts();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cart operations
  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQty = (productId, newQty) => {
    setCartItems(prev => prev.map(i => i.id === productId ? { ...i, quantity: newQty } : i));
  };

  const handleRemoveItem = (productId) => {
    setCartItems(prev => prev.filter(i => i.id !== productId));
  };

  // Wishlist toggle
  const handleWishlistToggle = (productId) => {
    setWishlist(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const [currentReservationId, setCurrentReservationId] = useState(null);

  // Flash drop trigger -> Open Waiting Room
  const handleBuyFlashDrop = () => {
    setIsWaitingRoomOpen(true);
  };

  // When admitted through Waiting Room
  const handleAdmittedFromWaitingRoom = async () => {
    const flashItem = products.find(p => p.isFlashSale) || products[0];
    
    // Call backend atomic reservation API
    try {
      const res = await axios.post('/api/shop/reserve', {
        productId: flashItem.id,
        userId: 'CUST-' + Math.floor(Math.random() * 100000),
        quantity: 1
      });
      if (res.data?.reservation) {
        setCurrentReservationId(res.data.reservation.reservationId);
      }
    } catch (e) {
      console.warn('Backend reservation response:', e.response?.data || e.message);
    }

    setCartItems(prev => {
      const exists = prev.find(i => i.id === flashItem.id);
      if (exists) return prev;
      return [{ ...flashItem, quantity: 1 }, ...prev];
    });
    setHasReservation(true);
    setIsCheckoutOpen(true);
    fetchStatus();
  };

  // Open Product Detail Modal
  const handleOpenProductDetail = (product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  // Triggering simulation scenario
  const handleTriggerScenario = async (scenarioKey) => {
    setLoading(true);
    try {
      await axios.post('/api/simulation/start', { scenario: scenarioKey });
    } catch (err) {
      console.error('Failed to start scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset simulation
  const handleReset = async () => {
    setLoading(true);
    try {
      await axios.post('/api/simulation/reset', { stock: 100 });
      await fetchStatus();
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1A1A] font-sans flex flex-col justify-between selection:bg-[#E8C88B]/30 selection:text-[#1A1A1A]">
      
      <div>
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          cartCount={cartItems.reduce((acc, i) => acc + i.quantity, 0)}
          wishlistCount={wishlist.length}
          openCart={() => setIsCartOpen(true)}
          onFlashDropClick={handleBuyFlashDrop}
          stockAvailable={status?.inventory?.available}
          onOpenSearch={() => {
            const el = document.getElementById('catalog');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Dynamic Story View Switch */}
        <main>
          {activeTab === 'store' ? (
            <CustomerStore
              products={products}
              stockInfo={status?.inventory}
              onBuyFlashDrop={handleBuyFlashDrop}
              onAddToCart={handleAddToCart}
              onOpenProductDetail={handleOpenProductDetail}
              onWishlistToggle={handleWishlistToggle}
              wishlist={wishlist}
            />
          ) : (
            <EngineeringCenter
              status={status}
              loading={loading}
              onTriggerScenario={handleTriggerScenario}
              onReset={handleReset}
              onOpenArchLab={() => setIsArchLabOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      <WaitingRoomModal
        isOpen={isWaitingRoomOpen}
        onClose={() => setIsWaitingRoomOpen(false)}
        onAdmitted={handleAdmittedFromWaitingRoom}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
        hasReservation={hasReservation}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        reservationId={currentReservationId}
        onOrderCompleted={(order) => {
          setHasReservation(false);
          setCartItems([]);
          setOrderTrackingData(order);
          fetchStatus();
        }}
        onOpenTracking={(order) => {
          setOrderTrackingData(order);
          setIsTrackingOpen(true);
        }}
      />

      <ProductDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        product={selectedProduct}
        onAddToCart={handleAddToCart}
        onBuyNow={(prod) => {
          handleAddToCart(prod);
          if (prod.isFlashSale) {
            handleBuyFlashDrop();
          } else {
            setIsCheckoutOpen(true);
          }
        }}
        stockAvailable={status?.inventory?.available}
      />

      <OrderTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
        orderData={orderTrackingData}
      />

      <ArchitectureLabModal
        isOpen={isArchLabOpen}
        onClose={() => setIsArchLabOpen(false)}
      />

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-white border-t border-[#EAE6DF] py-14 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-xs text-[#5F6B7A]">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="space-y-1">
              <span className="font-serif font-bold text-xl text-[#1A1A1A] block">
                GLOWRUSH
              </span>
              <p className="font-light">
                "Skincare in the fast lane. Premium skincare. Limited drops. Built for the rush."
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
              <button 
                onClick={() => setActiveTab(activeTab === 'store' ? 'engineering' : 'store')}
                className="text-[#A68758] hover:underline font-semibold"
              >
                {activeTab === 'store' ? '⚡ Open Engineering Dashboard' : '🛍️ View Customer Storefront'}
              </button>
              <button 
                onClick={() => setIsArchLabOpen(true)}
                className="text-[#A68758] hover:underline font-semibold"
              >
                Explore Architecture Lab (Diagrams)
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-[#F4ECE1] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-gray-400">
            <span>SALESTORM | SYSCRAFTERS 2026 HACKATHON</span>
            <span>MongoDB • Redis • RabbitMQ • React • Express</span>
          </div>

        </div>
      </footer>

    </div>
  );
}
