import React from 'react';
import { X, Truck, CheckCircle2, Clock, MapPin, Package, ShieldCheck, ArrowRight } from 'lucide-react';

export default function OrderTrackingModal({ isOpen, onClose, orderData }) {
  if (!isOpen) return null;

  const orderId = orderData?.orderId || 'GR-2026-00124';
  const trackingId = orderData?.trackingRef || 'TRK-9824-DEL';
  const carrier = 'Express Glow Logistics (Cold-Chain)';
  const expectedDate = orderData?.deliveryDate || '12 October 2026';

  const steps = [
    { title: 'CONFIRMED', desc: 'Payment verified & order recorded in MongoDB', done: true },
    { title: 'PROCESSING', desc: 'Formulation packaged in UV-protected sterile vault', done: true, current: true },
    { title: 'SHIPPED', desc: 'Dispatched from Bangalore Central Hub', done: false },
    { title: 'OUT FOR DELIVERY', desc: 'Courier courier out for local transit', done: false },
    { title: 'DELIVERED', desc: 'Arrived at your doorstep in safe thermal casing', done: false }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#EAE6DF] space-y-6">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-black transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
            Live Logistics Dispatch
          </span>
          <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            YOUR GLOW IS ON THE WAY.
          </h3>
          <p className="text-xs text-gray-500">
            Real-time fulfillment tracking dispatched over RabbitMQ events.
          </p>
        </div>

        {/* Meta Bar */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] text-xs">
          <div>
            <span className="text-gray-400 text-[10px] block">Order Identifier</span>
            <span className="font-mono font-bold text-[#1A1A1A]">{orderId}</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Tracking Number</span>
            <span className="font-mono font-bold text-[#A68758]">{trackingId}</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Delivery Courier</span>
            <span className="font-medium text-[#1A1A1A]">{carrier}</span>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] block">Estimated Arrival</span>
            <span className="font-bold text-[#10B981]">{expectedDate}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4 pt-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-4 items-start relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className={`absolute top-6 left-3 w-0.5 h-10 ${
                  step.done && !step.current ? 'bg-[#10B981]' : 'bg-[#EAE6DF]'
                }`} />
              )}

              {/* Status Circle */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                step.done && !step.current 
                  ? 'bg-[#10B981] text-white shadow-xs' 
                  : step.current 
                    ? 'bg-[#1A1A1A] text-white ring-4 ring-[#F4ECE1] animate-pulse' 
                    : 'bg-white border-2 border-gray-300 text-transparent'
              }`}>
                {step.done ? <CheckCircle2 size={14} /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
              </div>

              {/* Details */}
              <div className="flex-1 -mt-0.5">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-bold font-mono tracking-wider ${
                    step.current ? 'text-[#1A1A1A]' : step.done ? 'text-[#10B981]' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </h4>
                  {step.current && (
                    <span className="text-[10px] font-mono font-bold text-[#A68758] bg-[#F4ECE1] px-2 py-0.5 rounded-full">
                      IN PROGRESS
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all"
        >
          Return to Storefront
        </button>

      </div>
    </div>
  );
}
