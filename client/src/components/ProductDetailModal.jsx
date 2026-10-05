import React, { useState } from 'react';
import { X, Star, Zap, Clock, ShieldCheck, Truck, Sparkles, Check, Heart, Share2 } from 'lucide-react';

export default function ProductDetailModal({ 
  product, 
  isOpen, 
  onClose, 
  onBuyNow, 
  onAddToCart,
  stockAvailable 
}) {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('benefits'); // 'benefits', 'ingredients', 'usage', 'clinical'

  if (!isOpen || !product) return null;

  // Curated gallery images for product
  const gallery = [
    product.image,
    'https://images.unsplash.com/photo-1608248597359-20b17849cb15?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80'
  ];

  const available = stockAvailable !== undefined ? stockAvailable : (product.stockAvailable ?? 72);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#EAE6DF] overflow-hidden my-8">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-500 hover:text-black shadow-xs transition-colors"
        >
          <X size={20} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Gallery (5 cols) */}
          <div className="md:col-span-6 p-6 sm:p-8 bg-[#FAF8F5] flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#EAE6DF]">
            <div className="space-y-4">
              {/* Main Image */}
              <div className="relative h-80 sm:h-96 w-full rounded-2xl overflow-hidden bg-white shadow-xs">
                <img 
                  src={gallery[selectedImageIdx]} 
                  alt={product.name}
                  className="w-full h-full object-cover object-center transition-all duration-500" 
                />
                {product.isFlashSale && (
                  <div className="absolute top-3 left-3 bg-[#E07A5F] text-white text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1 rounded-full shadow-xs">
                    ⚡ FLASH DROP EXCLUSIVE
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3">
                {gallery.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIdx(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIdx === i ? 'border-[#C5A880] ring-1 ring-[#C5A880]' : 'border-[#EAE6DF] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-[#EAE6DF] flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#10B981]" />
                Clinically Formulated
              </span>
              <span className="flex items-center gap-1.5">
                <Truck size={16} className="text-[#A68758]" />
                Temperature Controlled
              </span>
            </div>
          </div>

          {/* Right Product Details (7 cols) */}
          <div className="md:col-span-6 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Status Header */}
              {product.isFlashSale ? (
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9EBE8] text-[#E07A5F] text-[11px] font-mono font-bold tracking-wider uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#E07A5F] animate-ping" />
                    STORM ACTIVE: High Demand
                  </div>
                  <span className="text-xs font-mono font-bold text-[#E07A5F] flex items-center gap-1">
                    <Clock size={14} /> 00:04:28
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
                  {product.category}
                </span>
              )}

              {/* Title & Tagline */}
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A] leading-tight">
                  {product.name}
                </h2>
                <p className="text-xs text-[#5F6B7A] mt-1.5">
                  {product.tagline}
                </p>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center text-[#F59E0B]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-[#F59E0B]" />
                  ))}
                </div>
                <span className="font-bold text-[#1A1A1A]">{product.rating}</span>
                <span className="text-gray-400">({product.reviewsCount} verified reviews)</span>
              </div>

              {/* Pricing & Savings */}
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-bold text-[#1A1A1A] font-serif">₹{product.price}</span>
                {product.originalPrice && (
                  <span className="text-sm text-gray-400 line-through">₹{product.originalPrice}</span>
                )}
                {product.discount && (
                  <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    {product.discount}
                  </span>
                )}
              </div>

              {/* Flash Stock Meter */}
              {product.isFlashSale && (
                <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EAE6DF] space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#5F6B7A]">Flash Allocation Vault</span>
                    <span className="font-mono font-bold text-[#1A1A1A]">{available} / 100 available</span>
                  </div>
                  <div className="h-2 w-full bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#C5A880] to-[#E07A5F] rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((available / 100) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Information Tabs */}
              <div className="border-b border-[#EAE6DF]">
                <div className="flex gap-5 text-xs font-semibold">
                  {[
                    { id: 'benefits', label: 'Benefits' },
                    { id: 'ingredients', label: 'Key Actives' },
                    { id: 'usage', label: 'How to Use' },
                    { id: 'clinical', label: 'Clinicals' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-2 transition-colors ${
                        activeTab === tab.id ? 'border-b-2 border-[#1A1A1A] text-[#1A1A1A]' : 'text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="text-xs text-[#5F6B7A] leading-relaxed min-h-[60px]">
                {activeTab === 'benefits' && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>Fades persistent hyperpigmentation and sun spots by up to 42% in 28 days.</li>
                    <li>Stimulates natural pro-collagen synthesis for firm, youthful skin bounce.</li>
                    <li>Neutralizes free radical damage and blue light oxidation.</li>
                  </ul>
                )}
                {activeTab === 'ingredients' && (
                  <p>
                    <strong>15% L-Ascorbic Acid (Pure Vitamin C)</strong>, 1% Alpha-Tocopherol (Vitamin E), 0.5% Ferulic Acid, Sodium Hyaluronate Multi-Depth Complex, Damascus Rose Hydrosol.
                  </p>
                )}
                {activeTab === 'usage' && (
                  <p>
                    Apply 3–4 drops in the morning onto clean, slightly damp facial skin. Press gently into the cheeks, forehead, and neck until fully absorbed. Always follow with DewyShield SPF 50+.
                  </p>
                )}
                {activeTab === 'clinical' && (
                  <p>
                    In an independent 8-week clinical trial of 120 participants: 94% reported visibly brighter tone, 91% reported enhanced texture, 0% experienced irritation.
                  </p>
                )}
              </div>

            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#EAE6DF] space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onAddToCart(product);
                    onClose();
                  }}
                  className="flex-1 py-3.5 rounded-xl border border-[#1A1A1A] text-[#1A1A1A] hover:bg-black/5 font-semibold text-xs tracking-wider uppercase transition-all"
                >
                  Add to Bag
                </button>

                <button
                  disabled={available === 0}
                  onClick={() => {
                    onBuyNow(product);
                    onClose();
                  }}
                  className={`flex-1 py-3.5 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    available === 0 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-[#1A1A1A] text-white hover:bg-black shadow-md'
                  }`}
                >
                  <Zap size={14} className={available > 0 ? 'fill-[#C5A880] text-[#C5A880]' : ''} />
                  {product.isFlashSale ? 'Instant Flash Buy' : 'Buy Now'}
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                Guaranteed safe checkout with 30-day glow guarantee.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
