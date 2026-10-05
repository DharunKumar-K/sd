import React, { useState, useEffect } from 'react';
import { ShoppingBag, Sparkles, Search, Heart, User, ArrowUpRight, Zap, Menu, X } from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  cartCount, 
  wishlistCount = 0,
  openCart, 
  onFlashDropClick, 
  stockAvailable,
  onOpenSearch
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-[#EAE6DF]' 
        : 'bg-[#FAF8F5]/90 backdrop-blur-xs border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Identity */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setActiveTab('store')}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1A1A1A] to-[#333333] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Sparkles size={16} className="text-[#C5A880]" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1A1A1A]">
              GLOWRUSH
            </span>
            <span className="text-[9px] tracking-widest uppercase font-mono text-[#A68758] -mt-1 font-semibold">
              Skincare in the fast lane
            </span>
          </div>
        </div>

        {/* Center Editorial Links */}
        <nav className="hidden lg:flex items-center gap-8 text-[13px] font-medium tracking-wide text-[#4B5563]">
          <button 
            onClick={() => setActiveTab('store')}
            className={`transition-colors hover:text-[#1A1A1A] ${
              activeTab === 'store' ? 'text-[#1A1A1A] font-semibold' : ''
            }`}
          >
            Shop Routine
          </button>
          
          <button 
            onClick={onFlashDropClick}
            className="flex items-center gap-1.5 text-[#E07A5F] hover:text-[#C86045] font-semibold transition-colors"
          >
            <Zap size={14} className="fill-[#E07A5F]" />
            Flash Drop
            <span className="text-[10px] bg-[#F9EBE8] text-[#E07A5F] px-2 py-0.5 rounded-full font-mono font-bold">
              {stockAvailable !== undefined ? `${stockAvailable} left` : '100 UNITS'}
            </span>
          </button>

          <a href="#catalog" className="hover:text-[#1A1A1A] transition-colors">
            Best Sellers
          </a>

          <a href="#collections" className="hover:text-[#1A1A1A] transition-colors">
            Collections
          </a>

          <a href="#skin-guide" className="hover:text-[#1A1A1A] transition-colors">
            Skin Guide
          </a>
        </nav>

        {/* Right Controls & Engineering Pill */}
        <div className="flex items-center gap-3">
          
          {/* Subtle Search */}
          <button 
            onClick={onOpenSearch}
            className="p-2 rounded-full text-gray-500 hover:text-black hover:bg-black/5 transition-colors"
            title="Search Products"
          >
            <Search size={18} />
          </button>

          {/* Wishlist */}
          <div className="relative">
            <button 
              className="p-2 rounded-full text-gray-500 hover:text-black hover:bg-black/5 transition-colors"
              title="Wishlist"
            >
              <Heart size={18} />
              {wishlistCount > 0 && (
                <span className="absolute 0 top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#E07A5F] text-white text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>
          </div>

          {/* Cart Bag */}
          <button 
            onClick={openCart}
            className="relative p-2 rounded-full text-gray-700 hover:text-black hover:bg-black/5 transition-colors"
            title="Bag"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#1A1A1A] text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Separator */}
          <div className="hidden sm:block h-5 w-px bg-[#EAE6DF]" />

          {/* SUBTLE LUXURY ENGINEERING BUTTON */}
          <button
            onClick={() => setActiveTab(activeTab === 'store' ? 'engineering' : 'store')}
            className={`group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all border ${
              activeTab === 'engineering'
                ? 'bg-[#1A1A1A] text-white border-black shadow-xs'
                : 'bg-white text-[#1A1A1A] border-[#EAE6DF] hover:border-[#C5A880] shadow-xs'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-semibold">
              {activeTab === 'engineering' ? 'SHOP STORE' : 'ENGINEERING'}
            </span>
            <ArrowUpRight size={13} className="text-[#C5A880] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>

          {/* Mobile hamburger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-[#EAE6DF] px-6 py-4 space-y-3 text-sm font-medium">
          <button 
            onClick={() => { setActiveTab('store'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-gray-800"
          >
            Shop Routine
          </button>
          <button 
            onClick={() => { onFlashDropClick(); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-[#E07A5F] font-bold"
          >
            Flash Drop ({stockAvailable ?? 100} units)
          </button>
          <button 
            onClick={() => { setActiveTab('engineering'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-emerald-700 font-mono font-bold"
          >
            ⚡ Engineering Command Center
          </button>
        </div>
      )}
    </header>
  );
}
