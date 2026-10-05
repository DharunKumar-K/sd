import React, { useState, useEffect } from 'react';
import { X, Trash2, Clock, ShieldCheck, ArrowRight, Sparkles, ShoppingBag } from 'lucide-react';

export default function CartDrawer({ 
  isOpen, 
  onClose, 
  cartItems, 
  onUpdateQty, 
  onRemoveItem, 
  onProceedToCheckout,
  hasReservation 
}) {
  const [timerSeconds, setTimerSeconds] = useState(272); // ~4m32s

  useEffect(() => {
    if (!isOpen || !hasReservation) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, hasReservation]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const savings = cartItems.some(i => i.isFlashSale) ? 300 : 0;
  const delivery = subtotal > 500 ? 0 : 49;
  const total = Math.max(0, subtotal - savings + (cartItems.length > 0 ? delivery : 0));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-[#EAE6DF]">
          
          {/* Header */}
          <div className="p-6 border-b border-[#EAE6DF] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">Your Bag</h2>
              <span className="text-xs font-mono font-bold bg-[#F4ECE1] text-[#A68758] px-2.5 py-0.5 rounded-full">
                {cartItems.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Flash Drop Reservation Countdown Banner */}
          {hasReservation && cartItems.some(i => i.isFlashSale) && (
            <div className="bg-[#FAF4ED] px-6 py-3.5 border-b border-[#F4ECE1] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#A68758] font-semibold tracking-wide">
                <Clock size={16} className="text-[#E07A5F]" />
                <span className="uppercase">RESERVED FOR YOU</span>
              </div>
              <span className="text-xs font-mono font-extrabold text-[#E07A5F] bg-white px-3 py-1 rounded-full border border-[#F4ECE1] shadow-2xs">
                {formatTimer(timerSeconds)} REMAINING
              </span>
            </div>
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {cartItems.length === 0 ? (
              <div className="text-center py-20 space-y-4 text-[#8C96A5]">
                <div className="w-16 h-16 rounded-full bg-[#FAF8F5] flex items-center justify-center mx-auto text-[#C5A880]">
                  <ShoppingBag size={28} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif text-xl font-bold text-[#1A1A1A]">Your glow starts here.</h4>
                  <p className="text-xs text-gray-500">Discover clinical skincare formulated for your routine.</p>
                </div>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-full bg-[#1A1A1A] text-white font-semibold text-xs uppercase tracking-wider hover:bg-black transition-all shadow-sm"
                >
                  Shop Skincare
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div 
                  key={item.id}
                  className="flex gap-4 p-4 rounded-2xl border border-[#EAE6DF] bg-[#FAF8F5] items-center"
                >
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-18 h-18 rounded-xl object-cover bg-white border border-[#EAE6DF]"
                  />

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#A68758] block font-semibold">
                      {item.category}
                    </span>
                    <h4 className="text-xs font-serif font-bold text-[#1A1A1A] truncate">{item.name}</h4>
                    <p className="text-xs text-[#1A1A1A] font-bold mt-0.5">₹{item.price}</p>
                    
                    {/* Stepper */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center border border-[#EAE6DF] rounded-lg bg-white">
                        <button 
                          onClick={() => onUpdateQty(item.id, Math.max(1, item.quantity - 1))}
                          className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="px-2.5 text-xs font-mono font-bold text-gray-900">{item.quantity}</span>
                        <button 
                          onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                          className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                          disabled={item.isFlashSale} // Max 1 per user during flash sale
                        >
                          +
                        </button>
                      </div>
                      <button 
                        onClick={() => onRemoveItem(item.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold font-serif text-[#1A1A1A]">₹{item.price * item.quantity}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal, Savings, Delivery & Total */}
          {cartItems.length > 0 && (
            <div className="p-6 border-t border-[#EAE6DF] bg-[#FAF8F5] space-y-4">
              <div className="space-y-2 text-xs text-[#5F6B7A]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-[#1A1A1A] font-semibold">₹{subtotal}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-[#10B981] font-medium">
                    <span>Flash Sale Privilege</span>
                    <span className="font-mono">-₹{savings}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Standard Delivery</span>
                  <span className="font-mono text-[#10B981] font-semibold">{delivery === 0 ? 'FREE' : `₹${delivery}`}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#1A1A1A] pt-2 border-t border-[#EAE6DF]">
                  <span className="font-serif">Total Amount</span>
                  <span className="font-mono text-lg">₹{total}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onProceedToCheckout();
                }}
                className="w-full py-4 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 group"
              >
                <span>CHECKOUT</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                <ShieldCheck size={14} className="text-[#10B981]" />
                <span>256-bit bank encrypted transactional guarantee</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
