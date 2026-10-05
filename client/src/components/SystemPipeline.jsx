import React from 'react';
import { Users, Shield, Server, Database, ShoppingCart, CreditCard, PackageCheck, Truck, Bell, ArrowRight } from 'lucide-react';

export default function SystemPipeline({ activeScenario, dbStatus, circuitBreaker, status }) {
  const isOrderDown = activeScenario === 'ORDER_SERVICE_DOWN';
  const isDbDown = dbStatus === 'DOWN' || activeScenario === 'DATABASE_FAILURE';
  const isGatewayDown = circuitBreaker?.state === 'OPEN' || activeScenario === 'PAYMENT_GATEWAY_FAILURE';
  const isTrafficSpike = activeScenario === 'TRAFFIC_SPIKE';
  const isRunning = status === 'RUNNING';

  const nodes = [
    { id: 'clients', label: '10k Shoppers', icon: <Users size={16} />, sub: 'Edge Traffic', status: isTrafficSpike ? 'SURGE' : 'NORMAL' },
    { id: 'stormshield', label: 'StormShield', icon: <Shield size={16} />, sub: 'Token Admission (Redis)', status: isTrafficSpike ? 'SURGE' : 'HEALTHY' },
    { id: 'gateway', label: 'API Gateway', icon: <Server size={16} />, sub: 'Auth / Rate Limit', status: 'HEALTHY' },
    { id: 'inventory', label: 'Inventory & Res', icon: <Database size={16} />, sub: 'MongoDB Atomic Authority', status: isDbDown ? 'FAILED' : 'HEALTHY' },
    { id: 'checkout', label: 'Checkout', icon: <ShoppingCart size={16} />, sub: 'Cart & Session', status: 'HEALTHY' },
    { id: 'payment', label: 'Payment Svc', icon: <CreditCard size={16} />, sub: 'Circuit Breaker / Idempotency', status: isGatewayDown ? 'WARNING' : 'HEALTHY' },
    { id: 'order', label: 'Order Svc', icon: <PackageCheck size={16} />, sub: 'RabbitMQ Consumer', status: isOrderDown ? 'DOWN' : 'HEALTHY' },
    { id: 'shipment', label: 'Fulfilment', icon: <Truck size={16} />, sub: 'Logistics Dispatch', status: 'HEALTHY' },
    { id: 'notification', label: 'Notification', icon: <Bell size={16} />, sub: 'Async SMS / Email', status: 'HEALTHY' }
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#EAE6DF] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4ECE1] pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#A68758] font-bold">
            Live Request Pipeline
          </span>
          <h3 className="font-serif text-lg font-bold text-[#1A1A1A]">
            End-to-End Distributed Architecture Flow
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Healthy
          </span>
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Throttle / Retry
          </span>
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Outage / Partition
          </span>
        </div>
      </div>

      {/* Horizontal Nodes Ribbon */}
      <div className="overflow-x-auto pb-2 custom-scrollbar">
        <div className="flex items-center min-w-[900px] justify-between py-2 relative">
          
          {nodes.map((node, index) => {
            const isFailing = node.status === 'DOWN' || node.status === 'FAILED';
            const isWarning = node.status === 'WARNING' || node.status === 'SURGE';

            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <div className={`relative flex flex-col items-center p-3 rounded-xl border text-center transition-all min-w-[100px] ${
                  isFailing
                    ? 'border-[#EF4444] bg-[#FEF2F2] shadow-sm animate-pulse'
                    : isWarning
                      ? 'border-[#F59E0B] bg-[#FFFBEB] shadow-sm'
                      : 'border-[#EAE6DF] bg-[#FCFBF8] hover:border-[#C5A880]'
                }`}>
                  
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${
                    isFailing 
                      ? 'bg-[#FEE2E2] text-[#EF4444]' 
                      : isWarning 
                        ? 'bg-[#FEF3C7] text-[#D97706]' 
                        : 'bg-[#F4ECE1] text-[#A68758]'
                  }`}>
                    {node.icon}
                  </div>

                  <span className="text-xs font-bold text-[#1A1A1A] whitespace-nowrap">
                    {node.label}
                  </span>
                  
                  <span className="text-[10px] text-gray-500 whitespace-nowrap mt-0.5">
                    {node.sub}
                  </span>

                  {/* Status Tag */}
                  <span className={`mt-2 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isFailing
                      ? 'bg-[#EF4444] text-white'
                      : isWarning
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-[#ECFDF5] text-[#10B981]'
                  }`}>
                    {node.status}
                  </span>
                </div>

                {/* Connecting Arrow with moving particle */}
                {index < nodes.length - 1 && (
                  <div className="relative flex-1 flex items-center justify-center px-1">
                    <div className="h-0.5 w-full bg-[#EAE6DF] relative overflow-hidden">
                      {isRunning && (
                        <div className="absolute top-0 bottom-0 w-6 bg-[#C5A880] rounded-full animate-[flowParticle_1.2s_linear_infinite]" />
                      )}
                    </div>
                    <ArrowRight size={14} className="text-gray-300 shrink-0 -ml-1" />
                  </div>
                )}
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {/* Infrastructure Sub-bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[#F4ECE1] text-xs">
        <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-between">
          <span className="font-semibold text-gray-700">Redis Cache & Queue</span>
          <span className="font-mono text-[#10B981] font-bold">CONNECTED (Admission Tokens)</span>
        </div>
        <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-between">
          <span className="font-semibold text-gray-700">MongoDB Cluster</span>
          <span className={`font-mono font-bold ${isDbDown ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
            {isDbDown ? 'SIMULATED DOWN' : 'CONNECTED (Atomic Authority)'}
          </span>
        </div>
        <div className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-between">
          <span className="font-semibold text-gray-700">RabbitMQ Message Broker</span>
          <span className={`font-mono font-bold ${isOrderDown ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
            {isOrderDown ? 'BUFFERING EVENTS (DLQ Ready)' : 'CONNECTED (Async Bus)'}
          </span>
        </div>
      </div>

    </div>
  );
}
