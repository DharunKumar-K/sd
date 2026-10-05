import { useState, useEffect } from 'react';
import { ShoppingBag, Clock, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

function App() {
  const [saleState, setSaleState] = useState('pre_sale'); // pre_sale, active, queued, reserved, sold_out
  const [queuePosition, setQueuePosition] = useState(0);
  const [waitTime, setWaitTime] = useState(0);

  // Simulate flash sale logic
  const handleBuyNow = () => {
    setSaleState('queued');
    // Simulate getting a random queue position between 500 and 2000
    const initialPosition = Math.floor(Math.random() * 1500) + 500;
    setQueuePosition(initialPosition);
    setWaitTime(Math.ceil(initialPosition / 50) * 3); // Approx 3s per batch of 50
  };

  useEffect(() => {
    let interval;
    if (saleState === 'queued') {
      interval = setInterval(() => {
        setQueuePosition((prev) => {
          const next = prev - (Math.floor(Math.random() * 20) + 30); // drop by ~30-50 per tick
          if (next <= 0) {
            clearInterval(interval);
            // Simulate random chance of getting it vs sold out
            const success = Math.random() > 0.3; // 70% chance of success in this simulation
            setSaleState(success ? 'reserved' : 'sold_out');
            return 0;
          }
          setWaitTime(Math.ceil(next / 50) * 3);
          return next;
        });
      }, 3000); // 3 seconds between batches (StormShield logic)
    }
    return () => clearInterval(interval);
  }, [saleState]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-brand-400/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="w-full p-6 glass-panel rounded-none border-t-0 border-x-0 flex justify-between items-center z-10">
        <div className="text-2xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent tracking-tighter">
          GLOWRUSH
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          Powered by StormShield™
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* Product Image */}
          <div className="relative group perspective">
            <div className="absolute -inset-2 bg-gradient-to-r from-brand-500 to-brand-300 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000" />
            <div className="relative rounded-2xl overflow-hidden glass-panel p-2 animate-float">
              <img 
                src="https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800" 
                alt="Radiance Vitamin C Serum" 
                className="w-full h-auto object-cover rounded-xl"
              />
              <div className="absolute top-6 right-6 bg-brand-600/90 backdrop-blur text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest shadow-lg">
                Flash Sale
              </div>
            </div>
          </div>

          {/* Product Info & Call to Action */}
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                Radiance <span className="font-light text-brand-300">C-Serum</span>
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed mb-6">
                Clinically proven to brighten and firm. 15% pure L-ascorbic acid. 
                Our most requested restock is finally here.
              </p>
              <div className="flex items-end gap-4 mb-2">
                <span className="text-5xl font-black text-white">₹2,999</span>
                <span className="text-xl text-slate-500 line-through mb-1">₹5,999</span>
              </div>
              <div className="inline-block px-3 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                Only 100 units available worldwide
              </div>
            </div>

            {/* Dynamic State Area */}
            <div className="mt-4 glass-panel p-6">
              
              {saleState === 'pre_sale' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-brand-200 bg-brand-900/30 p-3 rounded-lg border border-brand-800/50">
                    <Clock className="w-5 h-5" />
                    <span>Sale goes live at exactly 10:00 AM IST.</span>
                  </div>
                  <button 
                    onClick={handleBuyNow}
                    className="glass-button w-full py-4 flex items-center justify-center gap-2 text-lg"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Buy Now — Secure Inventory
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
                  <p className="text-xs text-slate-500 mt-2">Please do not refresh this page.</p>
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
                    All 100 units have been claimed. 
                  </p>
                  <p className="text-sm text-brand-300/80 mt-2">
                    Tip: Stay in queue! If a reservation expires, stock will be offered to the next in line.
                  </p>
                  <button 
                    onClick={() => setSaleState('pre_sale')}
                    className="mt-4 px-6 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition"
                  >
                    Return to Product
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
