import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, ArrowRight, X, Clock, ShieldCheck, Zap } from 'lucide-react';

export default function WaitingRoomModal({ isOpen, onClose, onAdmitted }) {
  const [stage, setStage] = useState('QUEUED'); // 'QUEUED', 'ADMITTED'
  const [queueNumber, setQueueNumber] = useState(1208);
  const [shoppersWaiting, setShoppersWaiting] = useState(12438);
  const [estimatedWait, setEstimatedWait] = useState(16);
  const [reservationCountdown, setReservationCountdown] = useState(298); // ~04:58

  useEffect(() => {
    if (!isOpen) {
      setStage('QUEUED');
      setQueueNumber(1208);
      setShoppersWaiting(12438);
      setEstimatedWait(16);
      setReservationCountdown(298);
      return;
    }

    // Dynamic queue simulation
    const queueInterval = setInterval(() => {
      setEstimatedWait(prev => {
        if (prev <= 1) {
          clearInterval(queueInterval);
          setStage('ADMITTED');
          return 0;
        }
        return prev - 1;
      });

      setShoppersWaiting(prev => Math.max(0, prev - 850));
      setQueueNumber(prev => Math.max(1, prev - 80));
    }, 1000);

    return () => clearInterval(queueInterval);
  }, [isOpen]);

  // Reservation countdown ticker once admitted
  useEffect(() => {
    if (stage !== 'ADMITTED') return;
    const ticker = setInterval(() => {
      setReservationCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(ticker);
  }, [stage]);

  if (!isOpen) return null;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-[#EAE6DF] text-center space-y-6 overflow-hidden">
        
        {/* Subtle radial luxury glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-36 bg-gradient-to-b from-[#F4ECE1] to-transparent rounded-full blur-2xl pointer-events-none -z-10" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-black transition-colors"
        >
          <X size={18} />
        </button>

        {stage === 'QUEUED' ? (
          <>
            {/* Shield and Status */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#A68758] block">
                GLOWRUSH FLASH DROP
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-tight">
                YOU'RE IN LINE
              </h2>
              <p className="text-xs text-gray-500 font-light max-w-xs mx-auto">
                "Your place is protected. We'll automatically admit you when it's your turn."
              </p>
            </div>

            {/* Queue Badge Numbers */}
            <div className="py-5 px-6 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] space-y-4 shadow-2xs">
              <div className="text-4xl sm:text-5xl font-mono font-extrabold text-[#1A1A1A] tracking-tight">
                #{queueNumber.toLocaleString()}
              </div>

              <div className="text-xs text-gray-500 font-mono">
                {shoppersWaiting.toLocaleString()} shoppers waiting
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-[#EAE6DF] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#C5A880] to-[#E07A5F] rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, Math.max(12, 100 - (estimatedWait * 6)))}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-gray-500 font-medium">Estimated wait</span>
                <span className="font-mono font-bold text-[#E07A5F]">{estimatedWait} sec</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-500">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#EAE6DF] text-[11px] font-mono text-[#A68758]">
                <Zap size={13} className="fill-[#C5A880] text-[#C5A880]" />
                <span>[ LIVE POSITION ] StormShield Active</span>
              </div>
            </div>
          </>
        ) : (
          /* ADMITTED STAGE */
          <>
            <div className="space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#10B981] shadow-xs">
                <CheckCircle size={36} />
              </div>
              
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#10B981] block">
                GLOWRUSH FLASH DROP
              </span>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
                YOU'RE IN.
              </h2>
              
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#A68758]">
                YOUR PURCHASE WINDOW IS OPEN.
              </p>
            </div>

            {/* Reservation Timer Box */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#E07A5F] font-bold block">
                RESERVATION WINDOW
              </span>
              <div className="text-4xl font-mono font-extrabold text-[#E07A5F] flex items-center justify-center gap-2">
                <Clock size={24} />
                {formatTime(reservationCountdown)}
              </div>
              <p className="text-[11px] text-gray-500 pt-1">
                1 unit held exclusively in the vault for your session.
              </p>
            </div>

            <button
              onClick={() => {
                onAdmitted();
                onClose();
              }}
              className="w-full py-4 rounded-xl bg-[#1A1A1A] text-white hover:bg-black font-semibold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 group"
            >
              <span>CONTINUE</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </>
        )}

      </div>
    </div>
  );
}
