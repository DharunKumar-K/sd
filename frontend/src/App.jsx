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
  const fetchProducts = () => {
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error fetching products:", err));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleBuyNow = async (product) => {
    setSelectedProduct(product);
    setSaleState('pre_sale');
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
      }, 1500); // Polling every 1.5s to match backend tick
    }
    return () => clearInterval(interval);
  }, [saleState, queueId]);

  const handleBack = () => {
    setSelectedProduct(null);
    setSaleState('pre_sale');
    setQueueId(null);
    fetchProducts(); // refresh stock on back
  };

  // Group products by category
  const categories = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-premium-dark text-slate-200">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none fixed" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-brand-400/10 rounded-full blur-[100px] pointer-events-none fixed" />

      {/* Header */}
      <header className="w-full p-6 glass-panel rounded-none border-t-0 border-x-0 flex justify-between items-center z-20 sticky top-0">
        <div className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent tracking-tighter cursor-pointer" onClick={handleBack}>
          GLOWRUSH
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400 bg-black/20 px-3 py-1 rounded-full border border-white/5">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          StormShield™ Active
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 z-10 w-full">
        
        {/* Product Grid View Grouped by Category */}
        {!selectedProduct && (
          <div className="max-w-7xl mx-auto pb-12">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Live Flash Sales
            </h1>
            <p className="text-slate-400 mb-12 max-w-2xl text-lg">
              Extremely limited quantities available. Our proprietary StormShield technology ensures fair queuing and prevents overselling.
            </p>
            
            {Object.keys(categories).map(category => (
              <div key={category} className="mb-16">
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-2xl font-bold text-brand-200 uppercase tracking-widest">{category}</h2>
                  <div className="h-px bg-gradient-to-r from-brand-500/50 to-transparent flex-grow"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {categories[category].map(product => (
                    <div key={product.id} className="glass-panel p-5 flex flex-col group hover:border-brand-500/40 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                      <div className="relative rounded-xl overflow-hidden mb-5 h-56 bg-black/50">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
                        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg border ${product.stock > 0 ? 'bg-brand-600/80 border-brand-500/50 text-white' : 'bg-red-900/80 border-red-500/50 text-red-100'}`}>
                          {product.stock > 0 ? `${product.stock} Units` : 'Sold Out'}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2 leading-tight">{product.name}</h3>
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-grow">{product.description}</p>
                      
                      <div className="flex items-end gap-3 mb-5 mt-auto">
                        <span className="text-2xl font-black text-white">₹{product.price}</span>
                        <span className="text-sm text-slate-500 line-through mb-1">₹{product.originalPrice}</span>
                      </div>
                      
                      <button 
                        onClick={() => handleBuyNow(product)}
                        className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${product.stock > 0 ? 'bg-gradient-to-r from-white to-slate-200 text-premium-dark hover:from-brand-100 hover:to-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'}`}
                        disabled={product.stock === 0}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {product.stock > 0 ? 'Enter Queue' : 'Out of Stock'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Product & Queue View */}
        {selectedProduct && (
          <div className="max-w-5xl mx-auto w-full pt-8">
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-8 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg w-fit border border-white/5">
              <ArrowLeft className="w-4 h-4" /> Back to Categories
            </button>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Product Image */}
              <div className="relative group perspective hidden md:block">
                <div className="absolute -inset-4 bg-gradient-to-tr from-brand-600 via-brand-400 to-brand-300 rounded-2xl blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000" />
                <div className="relative rounded-2xl overflow-hidden glass-panel p-2 shadow-2xl border-white/10">
                  <img 
                    src={selectedProduct.imageUrl} 
                    alt={selectedProduct.name} 
                    className="w-full h-[500px] object-cover rounded-xl"
                  />
                  <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md text-brand-300 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest border border-white/10">
                    {selectedProduct.category}
                  </div>
                </div>
              </div>

              {/* Product Info & Call to Action */}
              <div className="flex flex-col gap-6 relative z-10">
                <div>
                  <div className="inline-block px-3 py-1 bg-brand-900/40 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-widest rounded-md mb-4">
                    Flash Sale Active
                  </div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                    {selectedProduct.name}
                  </h1>
                  <p className="text-slate-400 text-lg leading-relaxed mb-8">
                    {selectedProduct.description}
                  </p>
                  
                  <div className="flex items-baseline gap-4 mb-4 p-4 glass-panel rounded-xl border-white/5">
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">₹{selectedProduct.price}</span>
                    <span className="text-xl text-slate-500 line-through">₹{selectedProduct.originalPrice}</span>
                  </div>
                </div>

                {/* Dynamic State Area */}
                <div className="mt-2 glass-panel p-8 border-brand-500/20 shadow-[0_0_30px_rgba(233,113,20,0.1)] relative overflow-hidden">
                  
                  {/* Subtle pulse background based on state */}
                  {saleState === 'queued' && <div className="absolute inset-0 bg-brand-500/5 animate-pulse-slow pointer-events-none" />}
                  {saleState === 'reserved' && <div className="absolute inset-0 bg-emerald-500/5 animate-pulse-slow pointer-events-none" />}
                  {saleState === 'sold_out' && <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />}

                  {saleState === 'pre_sale' && (
                    <div className="flex flex-col gap-6 relative z-10">
                      <div className="flex items-start gap-4 text-brand-200 bg-brand-950/50 p-4 rounded-xl border border-brand-800/50">
                        <Clock className="w-6 h-6 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-white mb-1">Queue Active</h4>
                          <p className="text-sm opacity-90">Click below to enter the StormShield queue. Do not refresh once queued.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleBuyNow(selectedProduct)}
                        className="glass-button w-full py-5 flex items-center justify-center gap-3 text-xl font-bold"
                      >
                        <ShoppingBag className="w-6 h-6" />
                        Enter Queue Now
                      </button>
                    </div>
                  )}

                  {saleState === 'queued' && (
                    <div className="flex flex-col items-center justify-center gap-6 text-center py-6 relative z-10">
                      <div className="relative w-20 h-20 mb-2">
                        <div className="absolute inset-0 border-4 border-premium-border rounded-full" />
                        <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShieldCheck className="w-8 h-8 text-brand-400" />
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">You are in line</h3>
                        <p className="text-brand-300 max-w-sm mx-auto">StormShield™ is controlling admission to prevent platform overload.</p>
                      </div>
                      
                      <div className="w-full grid grid-cols-2 gap-4 mt-2">
                        <div className="bg-black/40 p-5 rounded-xl border border-white/5 backdrop-blur-md">
                          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">People Ahead</div>
                          <div className="text-4xl font-mono text-white font-light">{queuePosition}</div>
                        </div>
                        <div className="bg-black/40 p-5 rounded-xl border border-white/5 backdrop-blur-md">
                          <div className="text-xs text-slate-400 uppercase tracking-widest mb-2">Est. Wait</div>
                          <div className="text-4xl font-mono text-white font-light">{waitTime}s</div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-500 mt-2 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                        Live updates active. Do not refresh.
                      </p>
                    </div>
                  )}

                  {saleState === 'reserved' && (
                    <div className="flex flex-col items-center justify-center gap-6 text-center py-6 relative z-10">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-full flex items-center justify-center mb-2 border border-emerald-500/20">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Inventory Reserved!</h3>
                        <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
                          We've securely held 1 unit for you. You have <span className="text-emerald-400 font-bold px-1">04:59</span> to complete checkout before it expires.
                        </p>
                      </div>
                      
                      <button className="w-full py-5 text-xl font-bold rounded-xl text-white bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.2)] hover:shadow-[0_0_40px_rgba(52,211,153,0.4)] transition-all duration-300">
                        Proceed to Secure Checkout
                      </button>
                    </div>
                  )}

                  {saleState === 'sold_out' && (
                    <div className="flex flex-col items-center justify-center gap-6 text-center py-6 relative z-10">
                      <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-full flex items-center justify-center mb-2 border border-red-500/20">
                        <XCircle className="w-10 h-10 text-red-400" />
                      </div>
                      
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Currently Sold Out</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">
                          All available units have been claimed by other customers.
                        </p>
                      </div>
                      
                      <div className="bg-red-950/30 border border-red-900/50 text-red-200 text-sm p-4 rounded-lg w-full">
                        Tip: You can stay here. If an existing reservation expires (unpaid), stock will be offered to the next person in line.
                      </div>
                      
                      <button 
                        onClick={handleBack}
                        className="mt-2 w-full py-4 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all font-bold"
                      >
                        Browse Other Flash Sales
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
