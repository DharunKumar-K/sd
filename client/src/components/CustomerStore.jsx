import React, { useState } from 'react';
import { 
  Sparkles, Zap, Star, ShieldCheck, ArrowRight, Heart, ShoppingBag, 
  Clock, Eye, ChevronRight, CheckCircle2, Droplets, Sun, Award
} from 'lucide-react';

export default function CustomerStore({ 
  products, 
  stockInfo, 
  onBuyFlashDrop, 
  onAddToCart, 
  onOpenProductDetail,
  onWishlistToggle,
  wishlist = []
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const flashProduct = products.find(p => p.isFlashSale) || products[0];

  const categories = [
    'All', 
    'Targeted Treatments', 
    'Hydration & Barrier', 
    'Moisturizers', 
    'Sun Protection', 
    'Toners & Essences', 
    'Cleansers'
  ];

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const availableStock = stockInfo?.available ?? 72;
  const totalStock = stockInfo?.total ?? 100;
  const stockPercentage = Math.round((availableStock / totalStock) * 100);

  return (
    <div className="space-y-24 pb-28">
      
      {/* ===================== HERO SECTION ===================== */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pt-16 sm:pb-24">
        
        {/* Soft luxury background aura */}
        <div className="absolute top-10 right-1/4 w-[480px] h-[480px] bg-gradient-to-br from-[#F4ECE1]/70 via-[#F9EBE8]/50 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute -bottom-10 left-10 w-[380px] h-[380px] bg-gradient-to-tr from-[#FAF8F5] to-[#F4ECE1]/60 rounded-full blur-2xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Brand & Editorial Typography */}
          <div className="lg:col-span-7 space-y-7">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F4ECE1] text-[#A68758] text-[11px] font-mono uppercase tracking-widest font-semibold">
              <Sparkles size={13} className="text-[#C5A880]" />
              Limited Drop • 100 Units Worldwide
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs font-bold tracking-widest uppercase text-gray-400 block">
                GLOWRUSH
              </span>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-[#1A1A1A] tracking-tight leading-[1.05]">
                SKINCARE<br />
                <span className="italic font-normal text-[#C5A880]">IN THE</span> FAST LANE.
              </h1>
            </div>

            <p className="text-base sm:text-lg text-[#5F6B7A] max-w-lg font-light leading-relaxed">
              High-performance clinical skincare engineered for your everyday glow. Crafted with pharmaceutical-grade actives and dropped in atomic flash allocations.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a 
                href="#catalog"
                className="px-8 py-4 rounded-full bg-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase hover:bg-black transition-all shadow-md"
              >
                Shop Skincare
              </a>
              <button
                onClick={onBuyFlashDrop}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-[#C5A880] to-[#A68758] text-white font-semibold text-xs tracking-wider uppercase hover:brightness-105 transition-all shadow-lg flex items-center gap-2 group"
              >
                <Zap size={15} className="fill-white" />
                Enter Flash Drop
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Social Trust Pillars */}
            <div className="pt-8 flex flex-wrap items-center gap-8 border-t border-[#EAE6DF] text-xs text-[#5F6B7A]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#10B981]" />
                <span>Zero Overselling Guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-[#C5A880]" />
                <span>Triple Clinical Active Matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[#F59E0B] fill-[#F59E0B]" />
                <span>4.9 / 5 Rating (2,800+ Reviews)</span>
              </div>
            </div>

          </div>

          {/* Right Column: Hero Product Composition with Floating Tags */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md">
              
              {/* Product Visual Container */}
              <div className="relative h-[480px] w-full rounded-3xl overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#F5F2EB] p-4 border border-[#EAE6DF] shadow-[0_25px_60px_-15px_rgba(197,168,128,0.25)] group">
                <img 
                  src={flashProduct.image} 
                  alt={flashProduct.name}
                  className="w-full h-full object-cover object-center rounded-2xl group-hover:scale-105 transition-transform duration-700" 
                />

                {/* Subtle shine overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

                {/* Top Corner Live Badge */}
                <div className="absolute top-7 left-7 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-mono font-bold text-[#E07A5F] shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E07A5F] animate-ping" />
                  FLASH DROP ACTIVE
                </div>

                <div className="absolute top-7 right-7 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-[#10B981] shadow-sm">
                  33% OFF
                </div>
              </div>

              {/* Floating Product Information Card */}
              <div className="absolute -bottom-6 -left-6 sm:-left-8 bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-[#EAE6DF] shadow-xl max-w-[280px] space-y-1.5 animate-pulse-glow">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold block">
                  VITAMIN C + HYALURONIC
                </span>
                <h4 className="font-serif text-sm font-bold text-[#1A1A1A] leading-snug">
                  BRIGHTENING FLASH SERUM
                </h4>
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-xl font-bold text-[#1A1A1A] font-serif">₹599</span>
                  <span className="text-xs text-gray-400 line-through">₹899</span>
                </div>
              </div>

              {/* Floating Stock Meter Pill */}
              <div className="absolute -top-4 -right-4 sm:-right-6 bg-[#1A1A1A] text-white rounded-2xl p-4 shadow-xl text-center space-y-1">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">
                  LIVE VAULT
                </span>
                <span className="text-lg font-mono font-extrabold text-[#C5A880] block">
                  {availableStock} / {totalStock}
                </span>
                <span className="text-[9px] text-gray-300 block">UNITS LEFT</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ===================== FLASH DROP HERO SECTION ===================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F5] to-[#F5F2EB] p-8 sm:p-12 border border-[#EAE6DF] shadow-lg overflow-hidden">
          
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-gradient-to-tl from-[#F4ECE1] to-transparent rounded-full blur-2xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* Left Flash Drop Announcement */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F9EBE8] text-[#E07A5F] text-xs font-mono font-bold uppercase tracking-wider">
                <Zap size={14} className="fill-[#E07A5F]" />
                GLOWRUSH FLASH DROP • 100 UNITS ONLY
              </div>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1A1A1A] leading-tight">
                ONE PRODUCT.<br />
                ONE WINDOW. ONE CHANCE.
              </h2>

              <p className="text-sm text-[#5F6B7A] max-w-lg leading-relaxed">
                When the window opens, thousands enter. Exactly 100 lucky customers claim the vault. Engineered with zero-oversell MongoDB atomic updates.
              </p>

              {/* Price & Savings */}
              <div className="flex items-baseline gap-4 pt-2">
                <span className="font-serif text-4xl font-extrabold text-[#1A1A1A]">₹599</span>
                <span className="text-lg text-gray-400 line-through">₹899</span>
                <span className="text-xs font-bold text-[#10B981] bg-[#ECFDF5] px-3 py-1 rounded-full">
                  33% PRIVILEGE DISCOUNT
                </span>
              </div>

              {/* Live Stock Bar */}
              <div className="pt-3 space-y-2 max-w-md">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#5F6B7A]">Live Stock Status</span>
                  <span className="font-mono font-bold text-[#1A1A1A]">{availableStock} / {totalStock} AVAILABLE</span>
                </div>
                
                <div className="h-3 w-full bg-[#EAE6DF] rounded-full overflow-hidden p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${
                      availableStock === 0 
                        ? 'bg-[#EF4444]' 
                        : availableStock < 20 
                          ? 'bg-[#E07A5F]' 
                          : 'bg-gradient-to-r from-[#C5A880] to-[#E07A5F]'
                    }`}
                    style={{ width: `${stockPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Action & Live Countdown */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl bg-white border border-[#EAE6DF] shadow-sm space-y-6 text-center">
              
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#A68758] font-bold">
                  DROP EXPIRES IN
                </span>
                <div className="font-mono text-4xl sm:text-5xl font-extrabold text-[#1A1A1A] tracking-wider flex items-center justify-center gap-2">
                  <Clock size={28} className="text-[#E07A5F]" />
                  00:04:28
                </div>
                <p className="text-[11px] text-gray-400">
                  StormShield queue maintains fair, bot-free admission
                </p>
              </div>

              <button
                disabled={availableStock === 0}
                onClick={onBuyFlashDrop}
                className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase transition-all shadow-md flex items-center justify-center gap-2 ${
                  availableStock === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#1A1A1A] text-white hover:bg-black hover:shadow-lg'
                }`}
              >
                <Zap size={16} className={availableStock > 0 ? 'fill-[#C5A880] text-[#C5A880]' : ''} />
                {availableStock === 0 ? 'SOLD OUT' : 'BUY NOW — ENTER QUEUE'}
              </button>

              <button
                onClick={() => onOpenProductDetail(flashProduct)}
                className="text-xs font-semibold text-[#A68758] hover:underline flex items-center gap-1"
              >
                <span>View Full Formulation & Clinicals</span>
                <ChevronRight size={14} />
              </button>

            </div>

          </div>

        </div>
      </section>

      {/* ===================== PRODUCT DISCOVERY (SHOP YOUR ROUTINE) ===================== */}
      <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Header & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#EAE6DF] pb-6">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A68758]">
              Clinical Formulations
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1A1A]">
              SHOP YOUR ROUTINE
            </h2>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full transition-all font-medium ${
                  selectedCategory === cat
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-[#EAE6DF] hover:border-gray-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((item) => {
            const isWishlisted = wishlist.includes(item.id);
            const inStock = item.isFlashSale ? availableStock > 0 : true;

            return (
              <div 
                key={item.id}
                className="group relative bg-white rounded-3xl p-5 border border-[#EAE6DF] hover:border-[#C5A880] transition-all hover:shadow-[0_16px_40px_-10px_rgba(0,0,0,0.06)] flex flex-col justify-between"
              >
                <div>
                  {/* Product Image & Badges */}
                  <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-[#FAF8F5] mb-5">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" 
                    />

                    {/* Flash Sale Tag */}
                    {item.isFlashSale && (
                      <span className="absolute top-3 left-3 bg-[#E07A5F] text-white text-[10px] font-mono uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm">
                        Flash Drop
                      </span>
                    )}

                    {/* Wishlist Button */}
                    <button 
                      onClick={() => onWishlistToggle && onWishlistToggle(item.id)}
                      className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-colors ${
                        isWishlisted ? 'bg-red-50 text-red-500' : 'bg-white/80 text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <Heart size={16} className={isWishlisted ? 'fill-red-500' : ''} />
                    </button>

                    {/* Quick View Button on Hover */}
                    <button
                      onClick={() => onOpenProductDetail(item)}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-md text-[#1A1A1A] px-4 py-1.5 rounded-full text-xs font-semibold shadow-md flex items-center gap-1.5"
                    >
                      <Eye size={13} /> Quick View
                    </button>
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono uppercase tracking-wider text-[#A68758] font-bold">
                        {item.category}
                      </span>
                      <span className="flex items-center gap-1 text-gray-800 font-medium font-mono">
                        <Star size={12} className="text-[#F59E0B] fill-[#F59E0B]" />
                        {item.rating} ({item.reviewsCount})
                      </span>
                    </div>

                    <h3 
                      onClick={() => onOpenProductDetail(item)}
                      className="font-serif text-lg font-bold text-[#1A1A1A] group-hover:text-[#A68758] transition-colors cursor-pointer"
                    >
                      {item.name}
                    </h3>

                    <p className="text-xs text-[#5F6B7A] line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Price & Cart Actions */}
                <div className="pt-4 border-t border-[#F4ECE1] mt-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold font-serif text-[#1A1A1A]">₹{item.price}</span>
                      {item.originalPrice && (
                        <span className="text-xs text-gray-400 line-through">₹{item.originalPrice}</span>
                      )}
                    </div>
                    {item.isFlashSale ? (
                      <span className="text-[11px] text-[#E07A5F] font-bold font-mono">
                        {availableStock} units in vault
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#10B981] font-medium">In stock</span>
                    )}
                  </div>

                  <button
                    disabled={!inStock}
                    onClick={() => {
                      if (item.isFlashSale) {
                        onBuyFlashDrop();
                      } else {
                        onAddToCart(item);
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      !inStock 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : item.isFlashSale
                          ? 'bg-[#1A1A1A] text-white hover:bg-black shadow-xs'
                          : 'bg-[#F4ECE1] text-[#A68758] hover:bg-[#EAE0D1]'
                    }`}
                  >
                    {item.isFlashSale ? <Zap size={14} className="fill-[#C5A880] text-[#C5A880]" /> : <ShoppingBag size={14} />}
                    {item.isFlashSale ? 'Flash Buy' : 'Add to Bag'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </section>

      {/* ===================== SKIN GUIDE / EDITORIAL CALLOUT ===================== */}
      <section id="skin-guide" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#1A1A1A] text-white p-8 sm:p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[#C5A880]">
              <Droplets size={20} />
            </div>
            <h4 className="font-serif text-lg font-bold">1. Cleanse & Hydrate</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Gentle oat milk jelly dissolves SPF and surface lipids without disturbing your natural skin mantle.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[#C5A880]">
              <Sparkles size={20} />
            </div>
            <h4 className="font-serif text-lg font-bold">2. Brighten & Activate</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Proprietary 15% pure Vitamin C delivers immediate tone brightening and antioxidant defense.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[#C5A880]">
              <Sun size={20} />
            </div>
            <h4 className="font-serif text-lg font-bold">3. Shield & Fortify</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Lightweight invisible fluid SPF 50+ blocks UVA, UVB, and environmental particulates with zero white cast.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
