import React, { useState } from 'react';
import { 
  X, Layers, ExternalLink, Maximize2, Minimize2, Check, ArrowRight, 
  ArrowLeft, Search, Database, Shield, Cpu, RefreshCw
} from 'lucide-react';

export default function ArchitectureLabModal({ isOpen, onClose }) {
  const [selectedStudent, setSelectedStudent] = useState(2); // 1, 2, or 3
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('interactive'); // 'interactive' or 'curated'

  if (!isOpen) return null;

  const studentDetails = {
    1: {
      number: 'STUDENT 01',
      title: 'SYSTEM ARCHITECT',
      subtitle: 'Global Ingestion Perimeter, Virtual Queuing & Microservices HLD',
      topics: ['HLD Architecture', 'Docker / Kubernetes', 'Deployment', 'StormShield Queue', 'Scalability'],
      htmlFile: '/student1_diagrams.html',
      takeaways: [
        'StormShield isolates 10k-50k RPS traffic surges at the perimeter before reaching backend clusters.',
        'Redis holds token buckets and queue positions; it never mutates authoritative stock.',
        'API Gateway enforces JWT validation, mutual TLS, and circuit-breaker bounded timeouts.'
      ]
    },
    2: {
      number: 'STUDENT 02',
      title: 'INVENTORY & LLD',
      subtitle: 'Atomic Conditional Mutations, Concurrency & State Machine Integrity',
      topics: ['Inventory Model', 'Reservation State Machine', 'Concurrency', 'Race Condition Elimination', 'MongoDB Atomic Update'],
      htmlFile: '/student2_diagrams.html',
      takeaways: [
        'Atomic conditional mutation: updateOne({ availableQuantity: { $gte: 1 } }, { $inc: { availableQuantity: -1, reservedQuantity: 1 } }).',
        'Redis is explicitly prohibited from holding authoritative stock; MongoDB is the sole transactional truth.',
        'Zero race condition vulnerability: even if 10,000 concurrent threads hit the collection simultaneously, exactly stock units succeed.'
      ]
    },
    3: {
      number: 'STUDENT 03',
      title: 'DATA & INTEGRATION',
      subtitle: 'MongoDB Document Schemas, Payment Idempotency & RabbitMQ Event Bus',
      topics: ['ER Document Models', 'Payment Lifecycle', 'Order State Machine', 'API Contracts', 'RabbitMQ DLQ'],
      htmlFile: '/student3_diagrams.html',
      takeaways: [
        'Payment idempotency keys prevent double charging even if network retransmits duplicate requests.',
        'RabbitMQ fanout/topic exchanges decouple Payment Service from Order and Fulfilment.',
        'Order Service outage tolerance: events buffer securely in RabbitMQ queues until service recovers.'
      ]
    }
  };

  const current = studentDetails[selectedStudent];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden">
      <div className={`relative w-full bg-white rounded-3xl shadow-2xl border border-[#EAE6DF] overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen ? 'h-full max-w-none rounded-none' : 'max-w-6xl h-[92vh]'
      }`}>
        
        {/* Header Ribbon */}
        <div className="p-5 sm:p-6 bg-[#FAF8F5] border-b border-[#EAE6DF] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
                ARCHITECTURE LAB
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500 font-serif italic">
                The Engineering Behind The Glow
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] mt-0.5">
              System Architecture & Diagram Explorer
            </h2>
          </div>

          {/* Student Selector Tabs */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-[#EAE6DF] shadow-2xs">
            {[1, 2, 3].map((num) => (
              <button
                key={num}
                onClick={() => setSelectedStudent(num)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  selectedStudent === num
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                STUDENT 0{num}
              </button>
            ))}
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <a
              href={current.htmlFile}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl text-gray-500 hover:text-[#C5A880] hover:bg-gray-100 transition-colors"
              title="Open standalone HTML in new tab"
            >
              <ExternalLink size={18} />
            </a>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-black transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-bar showing Student metadata */}
        <div className="px-6 py-3 bg-[#FAF8F5] border-b border-[#EAE6DF] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div>
            <span className="font-bold font-mono text-[#A68758] mr-2">{current.number}:</span>
            <span className="font-bold text-[#1A1A1A] mr-3">{current.title}</span>
            <span className="text-gray-500 hidden md:inline">— {current.subtitle}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {current.topics.map((t, idx) => (
              <span key={idx} className="bg-white px-2.5 py-0.5 rounded-md border border-[#EAE6DF] text-[10px] font-mono text-gray-600">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Embedded Interactive Viewer Frame */}
        <div className="flex-1 w-full bg-white relative overflow-hidden">
          <iframe 
            src={current.htmlFile}
            title={`${current.title} Diagrams`}
            className="w-full h-full border-none"
          />
        </div>

        {/* Bottom Architectural Invariants Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#EAE6DF] flex flex-col md:flex-row items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
              KEY ARCHITECTURAL GUARANTEES:
            </span>
            <span className="text-gray-700 hidden lg:inline">
              {current.takeaways[0]}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedStudent(prev => prev === 1 ? 3 : prev - 1)}
              className="px-3 py-1.5 rounded-lg border border-[#EAE6DF] bg-white text-gray-700 hover:bg-gray-50 font-mono text-xs flex items-center gap-1"
            >
              <ArrowLeft size={13} /> Prev Student
            </button>
            <button
              onClick={() => setSelectedStudent(prev => prev === 3 ? 1 : prev + 1)}
              className="px-3 py-1.5 rounded-lg border border-[#EAE6DF] bg-white text-gray-700 hover:bg-gray-50 font-mono text-xs flex items-center gap-1"
            >
              Next Student <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
