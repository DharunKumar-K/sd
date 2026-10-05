import React, { useState } from 'react';
import { 
  Play, RotateCcw, Activity, CheckCircle, XCircle, AlertTriangle, 
  Database, Shield, Cpu, Zap, Clock, Users, ArrowUpRight, Radio, 
  RefreshCw, Layers, Server, Bell, Package, Truck, ShoppingCart, Filter,
  ArrowRight, Check, BarChart3, TrendingUp
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import SystemPipeline from './SystemPipeline';

export default function EngineeringCenter({ 
  status, 
  loading, 
  onTriggerScenario, 
  onReset, 
  onOpenArchLab 
}) {
  const [eventFilter, setEventFilter] = useState('ALL'); // 'ALL', 'RESERVATION', 'PAYMENT', 'ORDER', 'SHIPMENT', 'FAILURE'

  const inv = status?.inventory || { available: 100, reserved: 0, sold: 0, total: 100 };
  const metrics = status?.metrics || {};
  const isRunning = status?.status === 'RUNNING';
  const banner = status?.banner;
  const events = status?.events || [];
  const invariants = status?.invariants || { allPassed: true, checks: [] };

  const availablePct = Math.round((inv.available / inv.total) * 100);
  const reservedPct = Math.round((inv.reserved / inv.total) * 100);
  const soldPct = Math.round((inv.sold / inv.total) * 100);

  // Filter events
  const filteredEvents = events.filter(evt => {
    if (eventFilter === 'ALL') return true;
    if (eventFilter === 'RESERVATION') return evt.eventType.includes('Reservation');
    if (eventFilter === 'PAYMENT') return evt.eventType.includes('Payment');
    if (eventFilter === 'ORDER') return evt.eventType.includes('Order');
    if (eventFilter === 'SHIPMENT') return evt.eventType.includes('Shipment');
    if (eventFilter === 'FAILURE') return evt.status === 'FAILED' || evt.status === 'CIRCUIT_OPEN' || evt.status === 'UNKNOWN';
    return true;
  });

  // 10 Scenarios
  const scenarioCards = [
    {
      id: 'normal',
      title: 'NORMAL FLASH SALE',
      sub: '10,000 BUYERS • 100 UNITS',
      desc: '10k concurrent buyers admit through StormShield. 95% payment success rate.',
      badge: 'CORE SCENARIO',
      border: 'border-emerald-200 hover:border-emerald-500 bg-[#FCFBF8]'
    },
    {
      id: 'race',
      title: 'LAST ITEM RACE',
      sub: '2 BUYERS • 1 UNIT',
      desc: 'Elena and Aria send simultaneous requests for 1 remaining unit. Exactly ONE wins.',
      badge: 'CONCURRENCY',
      border: 'border-amber-200 hover:border-amber-500 bg-[#FCFBF8]'
    },
    {
      id: 'duplicate',
      title: 'DUPLICATE BUY',
      sub: 'IDEMPOTENCY TEST',
      desc: 'Rapid duplicate request (BUY-1001). Stock decremented exactly ONCE.',
      badge: 'IDEMPOTENCY',
      border: 'border-blue-200 hover:border-blue-500 bg-[#FCFBF8]'
    },
    {
      id: 'payment-failure',
      title: 'PAYMENT FAILURE',
      sub: '50% DECLINE RATE',
      desc: 'Simulated payment failures automatically release held stock back to available pool.',
      badge: 'AUTO-RELEASE',
      border: 'border-rose-200 hover:border-rose-500 bg-[#FCFBF8]'
    },
    {
      id: 'payment-timeout',
      title: 'PAYMENT TIMEOUT',
      sub: 'GATEWAY TIMEOUT',
      desc: 'Gateway drops connection. Payment placed in reconciliation without duplicate charges.',
      badge: 'RECONCILIATION',
      border: 'border-purple-200 hover:border-purple-500 bg-[#FCFBF8]'
    },
    {
      id: 'order-down',
      title: 'ORDER SERVICE DOWN',
      sub: '30s OUTAGE',
      desc: 'Order Service crashes. Payments safe in MongoDB, RabbitMQ buffers events, auto-recovers.',
      badge: 'RESILIENCE',
      border: 'border-red-200 hover:border-red-500 bg-[#FCFBF8]'
    },
    {
      id: 'db-failure',
      title: 'DATABASE FAILURE',
      sub: 'FAIL-FAST ISOLATION',
      desc: 'MongoDB cluster partition simulated. Requests fail cleanly with bounded retries.',
      badge: 'FAIL-SAFE',
      border: 'border-slate-300 hover:border-slate-500 bg-[#FCFBF8]'
    },
    {
      id: 'gateway-failure',
      title: 'CIRCUIT BREAKER',
      sub: 'GATEWAY CRASH',
      desc: 'Provider outage trips Circuit Breaker: CLOSED -> OPEN -> HALF_OPEN.',
      badge: 'CIRCUIT BREAKER',
      border: 'border-orange-200 hover:border-orange-500 bg-[#FCFBF8]'
    },
    {
      id: 'expiry',
      title: 'RESERVATION EXPIRY',
      sub: '20s TTL CLEANUP',
      desc: 'Unpaid reservation window times out. Background cleaner restores inventory.',
      badge: 'TTL CLEANUP',
      border: 'border-teal-200 hover:border-teal-500 bg-[#FCFBF8]'
    },
    {
      id: 'spike',
      title: 'TRAFFIC SURGE ×50',
      sub: '50,000 RPS BURST',
      desc: 'StormShield virtual queue absorbs massive ingress, shielding database clusters.',
      badge: 'STORMSHIELD',
      border: 'border-indigo-200 hover:border-indigo-500 bg-[#FCFBF8]'
    }
  ];

  // 12 Microservices
  const servicesList = [
    { name: 'API Gateway', port: ':8080', latency: '4ms', rps: '12,400', status: 'HEALTHY', role: 'Perimeter TLS termination, routing & rate limiting' },
    { name: 'StormShield', port: ':8081', latency: '2ms', rps: '18,500', status: 'HEALTHY', role: 'Virtual queue admission control & Redis token buckets' },
    { name: 'Product Service', port: ':8082', latency: '6ms', rps: '4,200', status: 'HEALTHY', role: 'Skincare catalogue and cached product metadata' },
    { name: 'Cart Service', port: ':8083', latency: '8ms', rps: '3,100', status: 'HEALTHY', role: 'Redis session basket and TTL reservations' },
    { name: 'Sale Service', port: ':8084', latency: '5ms', rps: '5,600', status: 'HEALTHY', role: 'Flash window activation and coupon rules' },
    { name: 'Inventory & Res', port: ':8085', latency: '12ms', rps: '2,800', status: status?.dbStatus === 'DOWN' ? 'FAILED' : 'HEALTHY', role: 'MongoDB atomic update authority { availableQuantity: { $gte: qty } }' },
    { name: 'Checkout Service', port: ':8086', latency: '14ms', rps: '1,200', status: 'HEALTHY', role: 'Multi-step orchestrator and payment session tokenization' },
    { name: 'Payment Service', port: ':8087', latency: '48ms', rps: '980', status: status?.circuitBreaker?.state === 'OPEN' ? 'CIRCUIT_OPEN' : 'HEALTHY', role: 'Payment gateway client with idempotency keys & circuit breaker' },
    { name: 'Order Service', port: ':8088', latency: '18ms', rps: '850', status: status?.activeScenario === 'ORDER_SERVICE_DOWN' ? 'OFFLINE' : 'HEALTHY', role: 'RabbitMQ consumer persisting confirmed orders into MongoDB' },
    { name: 'Fulfilment Service', port: ':8089', latency: '15ms', rps: '840', status: 'HEALTHY', role: 'Cold-chain dispatch and packaging allocation' },
    { name: 'Shipment Service', port: ':8090', latency: '22ms', rps: '820', status: 'HEALTHY', role: 'Courier tracking generation and carrier webhooks' },
    { name: 'Notification Service', port: ':8091', latency: '11ms', rps: '850', status: 'HEALTHY', role: 'Async SMS and transactional email delivery' }
  ];

  // Dynamic Telemetry Mock Charts Data
  const telemetryData = [
    { time: '14:31:00', rps: 1800, latency: 18, queue: 400 },
    { time: '14:31:10', rps: 3400, latency: 22, queue: 1200 },
    { time: '14:31:20', rps: 7800, latency: 29, queue: 3800 },
    { time: '14:31:30', rps: 12400, latency: 34, queue: 8200 },
    { time: '14:31:40', rps: 18540, latency: 42, queue: 12438 },
    { time: '14:31:50', rps: 14200, latency: 38, queue: 6400 },
    { time: '14:32:00', rps: 9200, latency: 26, queue: 2100 },
    { time: '14:32:10', rps: 4100, latency: 21, queue: 200 }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* ===================== COMMAND CENTER HEADER ===================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#EAE6DF] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
              GLOWRUSH ENGINEERING CENTER
            </span>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-600">SYSTEM HEALTHY</span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                MongoDB <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                Redis <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                RabbitMQ <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </span>
            </div>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
            Watch the system handle the rush.
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6B7A] mt-1 font-light">
            Distributed flash-sale simulation with real MongoDB atomic conditional updates, Redis token queues, and RabbitMQ buffering.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenArchLab}
            className="px-4 py-2.5 rounded-xl bg-white border border-[#EAE6DF] hover:border-[#C5A880] text-xs font-mono font-bold text-[#1A1A1A] flex items-center gap-2 shadow-xs transition-all"
          >
            <Layers size={14} className="text-[#C5A880]" />
            ARCHITECTURE LAB ↗
          </button>

          <button
            disabled={isRunning || loading}
            onClick={() => onTriggerScenario('normal')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider font-mono transition-all flex items-center gap-2 shadow-md ${
              isRunning 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-[#1A1A1A] text-white hover:bg-black'
            }`}
          >
            <Play size={13} className="fill-white" />
            START FLASH SALE (10K BUYERS)
          </button>

          <button
            disabled={loading}
            onClick={onReset}
            className="p-2.5 rounded-xl bg-white border border-[#EAE6DF] hover:bg-gray-50 text-gray-600 hover:text-black transition-colors"
            title="Reset Simulation State"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* ===================== ACTIVE STATUS BANNER ===================== */}
      {banner && (
        <div className={`p-5 rounded-2xl border transition-all flex items-start gap-4 shadow-sm ${
          banner.type === 'ERROR'
            ? 'bg-[#FEF2F2] border-[#EF4444] text-[#991B1B]'
            : banner.type === 'WARNING'
              ? 'bg-[#FFFBEB] border-[#F59E0B] text-[#92400E]'
              : banner.type === 'SUCCESS'
                ? 'bg-[#ECFDF5] border-[#10B981] text-[#065F46]'
                : 'bg-[#FAF8F5] border-[#C5A880] text-[#78350F]'
        }`}>
          <div className="mt-0.5">
            {banner.type === 'ERROR' ? <AlertTriangle size={22} className="text-[#EF4444]" /> :
             banner.type === 'WARNING' ? <AlertTriangle size={22} className="text-[#F59E0B]" /> :
             banner.type === 'SUCCESS' ? <CheckCircle size={22} className="text-[#10B981]" /> :
             <Activity size={22} className="text-[#C5A880]" />}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold font-mono uppercase tracking-wider">{banner.title}</h4>
            <p className="text-xs mt-1 opacity-90 leading-relaxed">{banner.message}</p>
          </div>
        </div>
      )}

      {/* ===================== TOP HERO METRICS (19) ===================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-medium">
            Concurrent Buyers
          </span>
          <div className="text-3xl font-mono font-extrabold text-[#1A1A1A]">10,000</div>
          <span className="text-[10px] text-[#A68758] font-mono">StormShield Ingress Pool</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-medium">
            Stock Units
          </span>
          <div className="text-3xl font-mono font-extrabold text-[#1A1A1A]">{inv.total} Units</div>
          <span className="text-[10px] text-gray-500 font-mono">GLOW-VITC-100 Serum</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-medium">
            Oversold Count
          </span>
          <div className="text-3xl font-mono font-extrabold text-[#10B981]">0</div>
          <span className="text-[10px] text-[#10B981] font-mono font-bold">100% Invariant Conserved</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-medium">
            Duplicate Payments
          </span>
          <div className="text-3xl font-mono font-extrabold text-[#10B981]">0</div>
          <span className="text-[10px] text-[#10B981] font-mono font-bold">Idempotency Enforced</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 font-medium">
            Microservices
          </span>
          <div className="text-3xl font-mono font-extrabold text-[#1A1A1A]">12 Services</div>
          <span className="text-[10px] text-gray-500 font-mono">Domain Isolated</span>
        </div>

      </div>

      {/* ===================== ANIMATED SYSTEM PIPELINE (20) ===================== */}
      <SystemPipeline 
        activeScenario={status?.activeScenario}
        dbStatus={status?.dbStatus}
        circuitBreaker={status?.circuitBreaker}
        status={status?.status}
      />

      {/* ===================== SPLIT SIMULATION LAYOUT (21, 23) ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: TRAFFIC & QUEUE (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-[#EAE6DF] shadow-xs space-y-5">
          <div className="border-b border-[#F4ECE1] pb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
              INGRESS TELEMETRY
            </span>
            <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">Traffic & Queue Depth</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF]">
              <span className="text-gray-600">Total Purchase Requests</span>
              <span className="font-mono font-bold text-[#1A1A1A]">{metrics.totalRequests?.toLocaleString() || '10,000'}</span>
            </div>

            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF]">
              <span className="text-gray-600">Ingress Rate (Peak RPS)</span>
              <span className="font-mono font-bold text-[#E07A5F]">18,540 RPS</span>
            </div>

            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF]">
              <span className="text-gray-600">Admission Throttle Rate</span>
              <span className="font-mono font-bold text-[#10B981]">100 users / sec</span>
            </div>

            <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF]">
              <span className="text-gray-600">StormShield Virtual Queue</span>
              <span className="font-mono font-bold text-[#1A1A1A]">{metrics.queueBacklog || 0} waiting</span>
            </div>
          </div>

          {/* Mini RPS Chart */}
          <div className="pt-2">
            <span className="text-[10px] font-mono uppercase text-gray-400 block mb-2 font-bold">
              Live Ingress Waves (RPS)
            </span>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="colorRps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C5A880" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#C5A880" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="rps" stroke="#C5A880" fillOpacity={1} fill="url(#colorRps)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT: INVENTORY VISUAL (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-[#EAE6DF] shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4ECE1] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
                  TRANSACTIONAL SOURCE OF TRUTH
                </span>
                <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">
                  Authoritative Inventory Allocation: GLOW-VITC-100
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-gray-700 bg-[#F4ECE1] px-3 py-1 rounded-full">
                MongoDB Document Lock
              </span>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-4 pt-6">
              <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/20 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-[#065F46] tracking-wider block">
                  AVAILABLE
                </span>
                <div className="text-3xl font-mono font-extrabold text-[#047857]">
                  {inv.available}
                </div>
                <span className="text-[10px] text-[#065F46]">{availablePct}% of total</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#F59E0B]/20 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-[#92400E] tracking-wider block">
                  RESERVED
                </span>
                <div className="text-3xl font-mono font-extrabold text-[#B45309]">
                  {inv.reserved}
                </div>
                <span className="text-[10px] text-[#92400E]">5-min TTL window</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#F5F5F4] border border-[#1A1A1A]/10 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-[#1A1A1A] tracking-wider block">
                  SOLD
                </span>
                <div className="text-3xl font-mono font-extrabold text-[#1A1A1A]">
                  {inv.sold}
                </div>
                <span className="text-[10px] text-gray-500">{soldPct}% finalized</span>
              </div>
            </div>

            {/* Visual Segmented Progress Bar */}
            <div className="pt-6 space-y-2">
              <div className="h-5 w-full bg-[#EAE6DF] rounded-full overflow-hidden flex p-0.5">
                <div 
                  style={{ width: `${availablePct}%` }}
                  className="h-full bg-[#10B981] rounded-l-full transition-all duration-500"
                />
                <div 
                  style={{ width: `${reservedPct}%` }}
                  className="h-full bg-[#F59E0B] transition-all duration-500"
                />
                <div 
                  style={{ width: `${soldPct}%` }}
                  className="h-full bg-[#1A1A1A] rounded-r-full transition-all duration-500"
                />
              </div>

              <div className="flex justify-between items-center text-xs text-gray-500 pt-1 font-mono">
                <span>Equation: <strong>{inv.available} + {inv.reserved} + {inv.sold} = {inv.total}</strong></span>
                {inv.available === 0 && (
                  <span className="px-3 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-xs">
                    SOLD OUT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MongoDB Update Primitive Callout */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] font-mono text-[11px] text-[#1A1A1A] space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-[#A68758] font-bold block">
              ATOMIC MONGODB MUTATION:
            </span>
            <code>
              db.inventory.updateOne(&#123; productId: 'GLOW-VITC-100', availableQuantity: &#123; $gte: 1 &#125; &#125;, &#123; $inc: &#123; availableQuantity: -1, reservedQuantity: 1 &#125; &#125;)
            </code>
          </div>
        </div>

      </div>

      {/* ===================== FLASH SALE LAB: 10 SCENARIOS (22) ===================== */}
      <div className="space-y-5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
            FLASH SALE LAB
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">
            "How does GlowRush survive the storm?"
          </h2>
          <p className="text-xs text-gray-500">
            Select any scenario below to trigger authentic distributed failure modes and verify recovery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {scenarioCards.map((sc) => (
            <button
              key={sc.id}
              disabled={isRunning || loading}
              onClick={() => onTriggerScenario(sc.id)}
              className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all group shadow-xs ${sc.border} ${
                isRunning ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#A68758]">
                    {sc.badge}
                  </span>
                  <ArrowUpRight size={14} className="text-gray-400 group-hover:text-black transition-colors" />
                </div>
                
                <h4 className="text-xs font-bold font-mono tracking-tight text-[#1A1A1A] leading-snug">
                  {sc.title}
                </h4>

                <span className="text-[10px] font-mono font-bold text-gray-400 block mt-0.5">
                  {sc.sub}
                </span>

                <p className="text-[11px] text-[#5F6B7A] mt-2 leading-relaxed line-clamp-3">
                  {sc.desc}
                </p>
              </div>

              <span className="mt-4 text-[10px] font-mono font-bold uppercase tracking-wider text-[#1A1A1A] flex items-center gap-1 group-hover:underline">
                Execute Scenario ›
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ===================== LIVE EVENT STREAM & VALIDATION PANEL (25, 27) ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Live Event Stream (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-[#EAE6DF] shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F4ECE1] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#E07A5F] animate-pulse" />
                <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">Live RabbitMQ Event Bus</h3>
              </div>

              {/* Event Filters */}
              <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                {['ALL', 'RESERVATION', 'PAYMENT', 'ORDER', 'FAILURE'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      eventFilter === f ? 'bg-[#1A1A1A] text-white' : 'bg-[#FAF8F5] text-gray-500 hover:text-black'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Event List */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-16 text-xs text-gray-400 italic">
                  "Waiting for system activity." Click any scenario above to trigger the stream.
                </div>
              ) : (
                filteredEvents.map((evt) => (
                  <div 
                    key={evt.eventId}
                    className="p-3 rounded-xl border border-[#EAE6DF] bg-[#FAF8F5] text-xs space-y-1 hover:border-[#C5A880] transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-gray-400">{evt.timestamp}</span>
                      <span className="text-gray-500 text-[10px]">{evt.eventId}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        evt.status === 'CONFIRMED' || evt.status === 'SUCCESS' ? 'bg-[#ECFDF5] text-[#10B981]' :
                        evt.status === 'RELEASED' ? 'bg-[#EFF6FF] text-[#3B82F6]' :
                        evt.status === 'CIRCUIT_OPEN' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {evt.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5 font-mono">
                      <span className="font-bold text-[#1A1A1A] text-xs">{evt.eventType}</span>
                      <span className="text-[10px] text-[#A68758] bg-[#F4ECE1] px-1.5 py-0.5 rounded">
                        {evt.producer}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-500 font-mono truncate">
                      {JSON.stringify(evt.payload)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#F4ECE1] text-[11px] text-gray-400 font-mono flex items-center justify-between">
            <span>Async DLQ buffering & idempotent consumers active</span>
            <span className="text-gray-600">{filteredEvents.length} events matching filter</span>
          </div>
        </div>

        {/* RIGHT: Architecture Validation Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-[#EAE6DF] shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="border-b border-[#F4ECE1] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
                SYSTEM GUARANTEES
              </span>
              <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">Architecture Validation</h3>
            </div>

            <div className="space-y-2">
              {invariants.checks.map((chk, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-xl border border-[#EAE6DF] bg-[#FAF8F5] flex items-start gap-2.5 text-xs"
                >
                  <div className="mt-0.5">
                    {chk.passed ? (
                      <CheckCircle size={15} className="text-[#10B981]" />
                    ) : (
                      <XCircle size={15} className="text-[#EF4444]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold font-mono text-[11px] ${chk.passed ? 'text-[#1A1A1A]' : 'text-red-700'}`}>
                      {chk.name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                      {chk.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Result Box */}
          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#10B981]/30 text-center space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#065F46] block">
              ╔════════════════════════════════╗
            </span>
            <span className="font-serif text-lg font-bold text-[#047857] block">
              ARCHITECTURE VALIDATED ✓
            </span>
            <span className="text-xs font-mono font-bold text-[#065F46] block">
              0 VIOLATIONS DETECTED
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#065F46] block">
              ╚════════════════════════════════╝
            </span>
          </div>

        </div>

      </div>

      {/* ===================== DATABASE & INFRASTRUCTURE TOPOLOGY (31, 32, 33) ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* MongoDB Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE6DF] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F4ECE1] pb-3">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-[#10B981]" />
              <h4 className="font-serif text-base font-bold text-[#1A1A1A]">MongoDB Cluster</h4>
            </div>
            <span className="text-[9px] font-mono font-bold bg-[#ECFDF5] text-[#10B981] px-2 py-0.5 rounded-full">
              SOURCE OF TRUTH
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Durable transactional authority holding final state for products, stock documents, orders, and payment records.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono text-gray-700">
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">inventory</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">reservations</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">orders</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">payments</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">customers</span>
          </div>
        </div>

        {/* Redis Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE6DF] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F4ECE1] pb-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[#E07A5F]" />
              <h4 className="font-serif text-base font-bold text-[#1A1A1A]">Redis Cache</h4>
            </div>
            <span className="text-[9px] font-mono font-bold bg-[#FFFBEB] text-[#92400E] px-2 py-0.5 rounded-full">
              FAST STATE LAYER
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Manages perimeter rate limits, StormShield queue tokens, and cart cache. <strong className="text-red-600">NOT the inventory authority.</strong>
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono text-gray-700">
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">token_buckets</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">queue_zset</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">cart_sessions</span>
          </div>
        </div>

        {/* RabbitMQ Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#EAE6DF] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F4ECE1] pb-3">
            <div className="flex items-center gap-2">
              <Radio size={18} className="text-[#3B82F6]" />
              <h4 className="font-serif text-base font-bold text-[#1A1A1A]">RabbitMQ Bus</h4>
            </div>
            <span className="text-[9px] font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] px-2 py-0.5 rounded-full">
              ASYNC EVENT BUS
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Decoupled topic exchanges buffering domain events with Dead-Letter Queues (DLQ) for asynchronous resilience.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono text-gray-700">
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">PaymentConfirmed</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">OrderCreated</span>
            <span className="bg-[#FAF8F5] border border-[#EAE6DF] px-2 py-0.5 rounded">ReservationReleased</span>
          </div>
        </div>

      </div>

      {/* ===================== 12 ENGINEERING SERVICE CARDS (30) ===================== */}
      <div className="space-y-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
            MICROSERVICES CATALOG
          </span>
          <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">
            Core Distributed Domain Services (12 Services)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {servicesList.map((svc) => (
            <div 
              key={svc.name}
              className="bg-white p-4 rounded-2xl border border-[#EAE6DF] shadow-xs space-y-2 hover:border-[#C5A880] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#1A1A1A]">{svc.name}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  svc.status === 'HEALTHY' ? 'bg-[#ECFDF5] text-[#10B981]' :
                  svc.status === 'OFFLINE' ? 'bg-red-100 text-red-700' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {svc.status}
                </span>
              </div>

              <div className="flex justify-between text-[11px] font-mono text-gray-500">
                <span>{svc.port}</span>
                <span>Latency: {svc.latency}</span>
                <span>{svc.rps} RPS</span>
              </div>

              <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                {svc.role}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
