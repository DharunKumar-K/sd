import { useState, useEffect } from 'react';
import { ShoppingBag, Clock, ShieldCheck, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Sale state for the currently selected product
  const [saleState, setSaleState] = useState('pre_sale'); // pre_sale, queued, reserved, sold_out
  const [queueId, setQueueId] = useState(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [waitTime, setWaitTime] = useState(0);

  // Fetch products on mount
  useEffect(() => {
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error fetching products:", err));
  }, []);

  const handleBuyNow = async (product) => {
    setSelectedProduct(product);
    try {
      const res = await fetch('http://localhost:3000/api/stormshield/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });
      const data = await res.json();
      
      if (data.status === 'sold_out') {
        setSaleState('sold_out');
      } else {
        setQueueId(data.queueId);
        setQueuePosition(data.position);
        setWaitTime(data.estimatedWaitSeconds);
        setSaleState('queued');
      }
    } catch (err) {
      console.error("Error entering queue:", err);
    }
  };

  // Poll for queue status
  useEffect(() => {
    let interval;
    if (saleState === 'queued' && queueId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:3000/api/stormshield/status/${queueId}`);
          const data = await res.json();
          
          if (data.status === 'reserved') {
            setSaleState('reserved');
            clearInterval(interval);
          } else if (data.status === 'sold_out') {
            setSaleState('sold_out');
            clearInterval(interval);
          } else {
            setQueuePosition(data.position);
            setWaitTime(data.estimatedWaitSeconds);
          }
        } catch (err) {
          console.error("Error polling status:", err);
        }
      }, 2000); 
    }
    return () => clearInterval(interval);
  }, [saleState, queueId]);

  const handleBack = () => {
    setSelectedProduct(null);
    setSaleState('pre_sale');
    setQueueId(null);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-premium-dark text-slate-200">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none fixed" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-brand-400/10 rounded-full blur-[100px] pointer-events-none fixed" />

      {/* Header */}
      <header className="w-full p-6 glass-panel rounded-none border-t-0 border-x-0 flex justify-between items-center z-10 sticky top-0">
        <div className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent tracking-tighter cursor-pointer" onClick={handleBack}>
          GLOWRUSH
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          Powered by StormShield™
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 z-10">
        
        {/* Product Grid View */}
        {!selectedProduct && (
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-8">Live Flash Sales</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => (
                <div key={product.id} className="glass-panel p-4 flex flex-col group hover:border-brand-500/50 transition-colors">
                  <div className="relative rounded-xl overflow-hidden mb-4 h-64">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-3 right-3 bg-brand-600/90 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {product.stock > 0 ? `${product.stock} Units` : 'Sold Out'}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-2xl font-black text-white">₹{product.price}</span>
                    <span className="text-sm text-slate-500 line-through mb-1">₹{product.originalPrice}</span>
                  </div>
                  <button 
                    onClick={() => handleBuyNow(product)}
                    className={`mt-auto w-full py-3 rounded-xl font-semibold transition ${product.stock > 0 ? 'bg-white text-premium-dark hover:bg-brand-100' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    disabled={product.stock === 0}
                  >
                    {product.stock > 0 ? 'Enter Flash Sale' : 'Out of Stock'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Product & Queue View */}
        {selectedProduct && (
          <div className="max-w-4xl mx-auto w-full">
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-6">
              <ArrowLeft className="w-4 h-4" /> Back to Sales
            </button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Product Image */}
              <div className="relative group perspective">
                <div className="absolute -inset-2 bg-gradient-to-r from-brand-500 to-brand-300 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000" />
                <div className="relative rounded-2xl overflow-hidden glass-panel p-2">
                  <img 
                    src={selectedProduct.imageUrl} 
                    alt={selectedProduct.name} 
                    className="w-full h-auto object-cover rounded-xl"
                  />
                </div>
              </div>

              {/* Product Info & Call to Action */}
              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
                    {selectedProduct.name}
                  </h1>
                  <p className="text-slate-400 text-lg leading-relaxed mb-6">
                    {selectedProduct.description}
                  </p>
                  <div className="flex items-end gap-4 mb-2">
                    <span className="text-5xl font-black text-white">₹{selectedProduct.price}</span>
                    <span className="text-xl text-slate-500 line-through mb-1">₹{selectedProduct.originalPrice}</span>
                  </div>
                </div>

                {/* Dynamic State Area */}
                <div className="mt-2 glass-panel p-6">
                  
                  {saleState === 'pre_sale' && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3 text-brand-200 bg-brand-900/30 p-3 rounded-lg border border-brand-800/50">
                        <Clock className="w-5 h-5" />
                        <span>Sale is currently active. High traffic expected.</span>
                      </div>
                      <button 
                        onClick={() => handleBuyNow(selectedProduct)}
                        className="glass-button w-full py-4 flex items-center justify-center gap-2 text-lg"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        Buy Now
                      </button>
                    </div>
                  )}

                  {saleState === 'queued' && (
                    <div className="flex flex-col items-center justify-center gap-4 text-center py-4">
                      <div className="relative w-16 h-16 mb-2">
                        <div className="absolute inset-0 border-4 border-brand-900 rounded-full" />
                        <div className="absolute inset-0 border-4 border-brand-400 rounded-full border-t-transparent animate-spin" />
                      </div>
                      <h3 className="text-xl font-bold text-white">You are in the waiting queue</h3>
                      <p className="text-brand-300">StormShield™ is controlling admission to prevent overselling.</p>
                      
                      <div className="w-full grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-premium-dark p-4 rounded-xl border border-premium-border">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Position</div>
                          <div className="text-2xl font-mono text-white">{queuePosition}</div>
                        </div>
                        <div className="bg-premium-dark p-4 rounded-xl border border-premium-border">
                          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Est. Wait</div>
                          <div className="text-2xl font-mono text-white">~{waitTime}s</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {saleState === 'reserved' && (
                    <div className="flex flex-col items-center justify-center gap-4 text-center py-4">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Inventory Reserved!</h3>
                      <p className="text-slate-400 mb-4">
                        We've secured 1 unit for you. You have <span className="text-brand-400 font-bold">04:59</span> to complete checkout.
                      </p>
                      <button className="glass-button w-full py-4 text-lg bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                        Proceed to Payment
                      </button>
                    </div>
                  )}

                  {saleState === 'sold_out' && (
                    <div className="flex flex-col items-center justify-center gap-4 text-center py-4">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                        <XCircle className="w-10 h-10 text-red-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">Currently Sold Out</h3>
                      <p className="text-slate-400">
                        All units for {selectedProduct.name} have been claimed. 
                      </p>
                      <button 
                        onClick={handleBack}
                        className="mt-4 px-6 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                      >
                        Browse Other Sales
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
