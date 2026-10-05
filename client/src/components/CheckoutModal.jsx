import React, { useState, useEffect } from 'react';
import { 
  X, Check, CheckCircle2, Clock, ShieldCheck, CreditCard, 
  Smartphone, Building2, Truck, MapPin, ArrowRight, Loader2, RefreshCw, Wallet
} from 'lucide-react';
import axios from 'axios';

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  cartItems, 
  onOrderCompleted,
  onOpenTracking,
  reservationId 
}) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Address, 2: Delivery, 3: Payment, 4: Confirmation
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paymentState, setPaymentState] = useState('IDLE'); // 'IDLE', 'PROCESSING', 'SUCCESS', 'FAILED', 'TIMEOUT'
  const [orderData, setOrderData] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(261); // ~04:21 remaining

  useEffect(() => {
    if (!isOpen) return;
    const ticker = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(ticker);
  }, [isOpen]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const discount = cartItems.some(i => i.isFlashSale) ? 300 : 0;
  const total = Math.max(0, subtotal - discount);

  if (!isOpen) return null;

  const handleProcessPayment = async () => {
    setPaymentState('PROCESSING');

    try {
      const res = await axios.post('/api/shop/pay', {
        reservationId: reservationId || undefined,
        userId: 'USER-GUEST-' + Math.floor(Math.random() * 10000),
        amount: total,
        method: paymentMethod
      });

      setTimeout(() => {
        setPaymentState('SUCCESS');
        const confirmedOrder = {
          orderId: res.data?.order?.orderId || 'GR-2026-00124',
          paymentId: res.data?.payment?.paymentId || 'PAY-5521',
          transactionRef: `TXN-${Math.floor(Math.random() * 900000 + 100000)}`,
          deliveryDate: '12 October 2026',
          amount: total
        };
        setOrderData(confirmedOrder);
        setCurrentStep(4);
        if (onOrderCompleted) onOrderCompleted(confirmedOrder);
      }, 1600);

    } catch (err) {
      setTimeout(() => {
        setPaymentState('FAILED');
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#EAE6DF] overflow-hidden my-8">
        
        {/* Header with 4-Step Progress */}
        <div className="p-6 bg-[#FAF8F5] border-b border-[#EAE6DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
              GLOWRUSH CHECKOUT
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#1A1A1A]">Secure Checkout</h2>
          </div>

          {/* Stepper Progress */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {[
              { num: 1, label: 'ADDRESS' },
              { num: 2, label: 'DELIVERY' },
              { num: 3, label: 'PAYMENT' },
              { num: 4, label: 'CONFIRMATION' }
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-[11px] font-mono ${
                  currentStep === step.num 
                    ? 'bg-[#1A1A1A] text-white shadow-xs font-bold' 
                    : currentStep > step.num 
                      ? 'bg-[#ECFDF5] text-[#10B981]' 
                      : 'bg-white text-gray-400 border border-[#EAE6DF]'
                }`}>
                  {currentStep > step.num ? <Check size={12} /> : <span>0{step.num}</span>}
                  <span className="hidden md:inline">{step.label}</span>
                </div>
                {idx < 3 && <span className="text-gray-300">›</span>}
              </React.Fragment>
            ))}
          </div>

          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-black transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          
          {/* Main Step Form (Left) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            
            {/* STEP 1: ADDRESS */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                    <MapPin size={18} className="text-[#A68758]" /> 01 Shipping Address
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">Step 1 of 4</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">First Name</label>
                    <input type="text" defaultValue="Elena" className="w-full p-3 rounded-xl border border-[#EAE6DF] focus:border-[#C5A880] outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">Last Name</label>
                    <input type="text" defaultValue="Vance" className="w-full p-3 rounded-xl border border-[#EAE6DF] focus:border-[#C5A880] outline-none" />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block text-gray-600 mb-1 font-medium">Street Address</label>
                  <input type="text" defaultValue="Flat 402, Lotus Orchid, Palm Avenue" className="w-full p-3 rounded-xl border border-[#EAE6DF] focus:border-[#C5A880] outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">City</label>
                    <input type="text" defaultValue="Bangalore" className="w-full p-3 rounded-xl border border-[#EAE6DF] focus:border-[#C5A880] outline-none" />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">PIN Code</label>
                    <input type="text" defaultValue="560038" className="w-full p-3 rounded-xl border border-[#EAE6DF] focus:border-[#C5A880] outline-none font-mono" />
                  </div>
                </div>

                <button 
                  onClick={() => setCurrentStep(2)}
                  className="w-full mt-4 py-3.5 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                >
                  Continue to Delivery <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* STEP 2: DELIVERY */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                    <Truck size={18} className="text-[#A68758]" /> 02 Delivery Method
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">Step 2 of 4</span>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 rounded-2xl border-2 border-[#1A1A1A] bg-[#FAF8F5] cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white text-[10px]">✓</div>
                      <div>
                        <div className="text-xs font-bold text-[#1A1A1A]">Priority Flash Air Express</div>
                        <div className="text-[11px] text-gray-500">24-48 hr cold-chain temperature-controlled transit</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#10B981] font-mono">FREE</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setCurrentStep(1)}
                    className="py-3 px-6 rounded-xl border border-[#EAE6DF] text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-3.5 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2"
                  >
                    Proceed to Payment <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#EAE6DF] pb-3">
                  <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                    <CreditCard size={18} className="text-[#A68758]" /> 03 Payment Method
                  </h3>
                  <span className="text-[11px] text-gray-400 font-mono">Step 3 of 4</span>
                </div>

                {paymentState === 'PROCESSING' ? (
                  <div className="py-14 text-center space-y-4">
                    <Loader2 size={36} className="mx-auto text-[#C5A880] animate-spin" />
                    <div>
                      <h4 className="font-serif text-xl font-bold text-[#1A1A1A] tracking-tight">PROCESSING PAYMENT</h4>
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        Cryptographic idempotency check with provider...
                      </p>
                    </div>
                  </div>
                ) : paymentState === 'TIMEOUT' ? (
                  <div className="py-10 text-center space-y-4">
                    <Clock size={36} className="mx-auto text-[#F59E0B] animate-pulse" />
                    <h4 className="font-serif text-lg font-bold text-[#92400E]">VERIFYING PAYMENT</h4>
                    <p className="text-xs text-gray-600 max-w-sm mx-auto">
                      "Your payment status is being confirmed. Transaction safely placed in reconciliation queue to prevent duplicate charges."
                    </p>
                  </div>
                ) : paymentState === 'FAILED' ? (
                  <div className="py-10 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">✕</div>
                    <h4 className="font-serif text-xl font-bold text-red-600">PAYMENT FAILED</h4>
                    <p className="text-xs text-gray-500">Card was declined by provider. Your stock reservation is still held.</p>
                    <button 
                      onClick={() => setPaymentState('IDLE')}
                      className="px-6 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-xs font-semibold flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw size={14} /> TRY AGAIN
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[
                        { id: 'UPI', label: 'UPI / QR', icon: <Smartphone size={16} /> },
                        { id: 'CARD', label: 'Cards', icon: <CreditCard size={16} /> },
                        { id: 'WALLET', label: 'Wallet', icon: <Wallet size={16} /> },
                        { id: 'NETBANK', label: 'Net Banking', icon: <Building2 size={16} /> }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setPaymentMethod(item.id)}
                          className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                            paymentMethod === item.id 
                              ? 'border-[#1A1A1A] bg-[#FAF8F5] text-[#1A1A1A] shadow-xs' 
                              : 'border-[#EAE6DF] text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {item.icon}
                          <span className="text-[11px]">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'UPI' && (
                      <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] space-y-2 text-xs">
                        <label className="block text-gray-600 font-medium">Virtual Payment Address (UPI ID)</label>
                        <input 
                          type="text" 
                          defaultValue="elena.vance@okhdfcbank" 
                          className="w-full p-3 rounded-xl border border-[#EAE6DF] bg-white focus:border-[#C5A880] outline-none font-mono"
                        />
                      </div>
                    )}

                    {paymentMethod === 'CARD' && (
                      <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] space-y-3 text-xs">
                        <div>
                          <label className="block text-gray-600 font-medium mb-1">Card Number</label>
                          <input type="text" defaultValue="•••• •••• •••• 4242" className="w-full p-3 rounded-xl border border-[#EAE6DF] bg-white font-mono" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-600 font-medium mb-1">Expiry</label>
                            <input type="text" defaultValue="08/29" className="w-full p-3 rounded-xl border border-[#EAE6DF] bg-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-gray-600 font-medium mb-1">CVV</label>
                            <input type="password" defaultValue="•••" className="w-full p-3 rounded-xl border border-[#EAE6DF] bg-white font-mono" />
                          </div>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleProcessPayment}
                      className="w-full py-4 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      Pay ₹{total} Now
                    </button>
                  </>
                )}
              </div>
            )}

            {/* STEP 4: ORDER CONFIRMED */}
            {currentStep === 4 && (
              <div className="py-4 space-y-6 text-center">
                <div className="w-18 h-18 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 size={44} />
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#10B981] block">
                    ✓ PAYMENT SUCCESSFUL
                  </span>
                  <h3 className="font-serif text-3xl font-bold text-[#1A1A1A] mt-1">
                    ORDER CONFIRMED
                  </h3>
                  <p className="text-xs font-mono font-bold text-gray-700 mt-1">
                    Order #{orderData?.orderId || 'GR-2026-00124'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Expected Delivery: <span className="font-semibold text-gray-900">{orderData?.deliveryDate}</span>
                  </p>
                </div>

                {/* Timeline */}
                <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] text-left space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#A68758] font-bold block">
                    Order State Progression
                  </span>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2.5 text-[#10B981] font-semibold">
                      <span className="w-4 h-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px]">✓</span>
                      <span>Payment Confirmed ({orderData?.paymentId || 'P-5521'})</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[#10B981] font-semibold">
                      <span className="w-4 h-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px]">✓</span>
                      <span>Order Created ({orderData?.orderId || 'O-8821'})</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[#1A1A1A] font-semibold">
                      <span className="w-4 h-4 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px]">●</span>
                      <span>Processing in Vault</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px]">○</span>
                      <span>Shipped</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px]">○</span>
                      <span>Out for Delivery</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px]">○</span>
                      <span>Delivered</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-3.5 rounded-xl border border-[#1A1A1A] text-[#1A1A1A] hover:bg-black/5 font-semibold text-xs tracking-wider uppercase transition-all"
                  >
                    CONTINUE SHOPPING
                  </button>
                  <button 
                    onClick={() => {
                      onClose();
                      if (onOpenTracking) onOpenTracking(orderData);
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all shadow-md"
                  >
                    TRACK ORDER
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Summary Sidebar */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-[#FAF8F5] border-t lg:border-t-0 lg:border-l border-[#EAE6DF] space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE6DF]">
                <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">Order Summary</h4>
                <div className="text-[11px] font-mono text-[#E07A5F] flex items-center gap-1 font-bold">
                  <Clock size={13} />
                  <span>{formatTimer(timerSeconds)} REMAINING</span>
                </div>
              </div>

              {/* Items mini list */}
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3 text-xs items-center">
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover bg-white border border-[#EAE6DF]" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1A1A1A] truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-mono font-bold text-[#1A1A1A]">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Accounting details */}
              <div className="pt-3 border-t border-[#EAE6DF] space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#10B981]">
                    <span>Flash Privilege Discount</span>
                    <span className="font-mono">-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Priority Air Shipping</span>
                  <span className="font-mono text-[#10B981]">FREE</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#1A1A1A] pt-2 border-t border-[#EAE6DF]">
                  <span className="font-serif">Total</span>
                  <span className="font-mono text-base">₹{total}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAE6DF] text-[11px] text-gray-500 space-y-1">
              <div className="flex items-center gap-1 text-[#10B981]">
                <ShieldCheck size={14} />
                <span className="font-semibold">Atomic Stock Allocation Guard</span>
              </div>
              <p>Reserved strictly in MongoDB document lock during session.</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
