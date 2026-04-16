import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone, MessageSquare, Menu, X, Zap, Navigation as NavIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { ThemeToggle } from './ThemeToggle';
import { WHATSAPP_NUMBER, PHONE_NUMBER, DISPLAY_PHONE } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';

const TopBar = () => {
  return (
    <div className="bg-brand-neon text-brand-bg py-2 px-4 relative z-[60]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-bg animate-pulse" />
            Urgent Dispatch Active
          </span>
          <span className="hidden md:inline opacity-60">|</span>
          <span className="hidden md:inline">Dubai ↔ Abu Dhabi (90-120 Min Delivery)</span>
        </div>
        <div className="flex items-center gap-6">
          <a href={`tel:${PHONE_NUMBER}`} onClick={trackPhoneClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Phone className="w-3 h-3 fill-brand-bg" />
            <span>Call Now: {DISPLAY_PHONE}</span>
          </a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} onClick={() => trackWhatsAppClick('top_bar')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <MessageSquare className="w-3 h-3 fill-brand-bg" />
            <span>WhatsApp Dispatch</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export const Navigation = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();

  return (
    <nav className={cn(
      "bg-brand-bg/80 backdrop-blur-md border-b border-brand-border transition-all duration-300"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-brand-neon flex items-center justify-center text-brand-bg transition-transform group-hover:scale-105">
              <Zap className="w-5 h-5 fill-brand-bg" />
            </div>
            <span className="text-xl font-display font-medium tracking-tighter uppercase">
              Nokael<span className="text-brand-neon">.</span>
            </span>
          </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/services"
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.2em] transition-colors hover:text-brand-neon",
                  location.pathname === "/services" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Urgent Courier Routes
              </Link>
              <Link
                to="/get-quote"
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.2em] transition-colors hover:text-brand-neon",
                  location.pathname === "/get-quote" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Request Immediate Pickup
              </Link>
              <Link
                to="/track"
                className={cn(
                  "text-[11px] font-bold uppercase tracking-[0.2em] transition-colors hover:text-brand-neon",
                  location.pathname === "/track" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Live Tracking
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-4 border-l border-brand-border pl-8">
              <ThemeToggle />
              <Link
                to="/get-quote"
                className="px-5 py-2 bg-brand-surface border border-brand-border text-brand-text font-bold rounded-lg text-[10px] uppercase tracking-widest hover:bg-brand-muted/10 transition-all"
              >
                Dispatch Now
              </Link>
            </div>

            {/* Mobile Toggle */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <button
              className="p-2 text-brand-muted hover:text-brand-text transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-brand-bg border-b border-brand-border overflow-hidden"
          >
            <div className="px-4 py-8 space-y-6">
              <Link
                to="/services"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tighter"
              >
                Urgent Courier Routes
              </Link>
              <Link
                to="/get-quote"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tighter"
              >
                Request Immediate Pickup
              </Link>
              <Link
                to="/track"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tighter"
              >
                Live Tracking
              </Link>
              <div className="pt-6 grid grid-cols-1 gap-4">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  onClick={() => trackWhatsAppClick('mobile_nav')}
                  className="btn-primary w-full"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Dispatch</span>
                </a>
                <a
                  href={`tel:${PHONE_NUMBER}`}
                  onClick={trackPhoneClick}
                  className="btn-secondary w-full"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Dispatch</span>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export const Footer = () => {
  return (
    <footer className="bg-brand-bg border-t border-brand-border pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-24">
          <div className="md:col-span-5">
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-6 h-6 rounded bg-brand-neon flex items-center justify-center text-brand-bg">
                <Zap className="w-4 h-4 fill-brand-bg" />
              </div>
              <span className="text-lg font-display font-medium tracking-tighter uppercase">
                Nokael<span className="text-brand-neon">.</span>
              </span>
            </Link>
            <p className="text-brand-muted max-w-sm leading-relaxed mb-10 text-sm">
              Direct-response logistics dispatch system for urgent inter-emirate delivery across the UAE. Built for operators, not browsers.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-brand-neon" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-muted">System Status: Operational</span>
            </div>
          </div>
          
          <div className="md:col-span-3">
            <h4 className="text-brand-text font-bold uppercase tracking-[0.2em] text-[10px] mb-8">Logistics Corridors</h4>
            <ul className="space-y-4 text-xs text-brand-muted">
              <li className="flex items-center gap-2 group/link">
                <div className="w-1 h-1 rounded-full bg-brand-neon opacity-0 group-hover/link:opacity-100 transition-opacity" />
                <Link to="/urgent-delivery-dubai" className="hover:text-brand-neon transition-colors">Same-Day Courier in Dubai</Link>
              </li>
              <li className="flex items-center gap-2 group/link">
                <div className="w-1 h-1 rounded-full bg-brand-neon opacity-0 group-hover/link:opacity-100 transition-opacity" />
                <Link to="/urgent-delivery-abu-dhabi" className="hover:text-brand-neon transition-colors">Urgent Delivery Abu Dhabi</Link>
              </li>
              <li className="flex items-center gap-2 group/link">
                <div className="w-1 h-1 rounded-full bg-brand-neon opacity-0 group-hover/link:opacity-100 transition-opacity" />
                <Link to="/services" className="hover:text-brand-neon transition-colors">Urgent Inter-Emirate Routes</Link>
              </li>
              <li><Link to="/document-delivery-uae" className="hover:text-brand-neon transition-colors">Document Tenders</Link></li>
              <li><Link to="/spare-parts-delivery-uae" className="hover:text-brand-neon transition-colors">Spare Parts Site Delivery</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="text-brand-text font-bold uppercase tracking-[0.2em] text-[10px] mb-8">Dispatch Command</h4>
            <ul className="space-y-4 text-xs text-brand-muted">
              <li><Link to="/track" className="hover:text-brand-neon transition-colors">Live GPS Tracking</Link></li>
              <li><Link to="/get-quote" className="hover:text-brand-neon transition-colors">Request Quote</Link></li>
              <li><Link to="/business-account" className="hover:text-brand-neon transition-colors">Business Accounts</Link></li>
              <li><Link to="/apply-driver" className="hover:text-brand-neon transition-colors">Driver Intake</Link></li>
              <li>
                <a 
                  href={`https://wa.me/${WHATSAPP_NUMBER}`} 
                  onClick={() => trackWhatsAppClick('footer')}
                  className="hover:text-brand-neon transition-colors"
                >
                  WhatsApp Dispatch
                </a>
              </li>
              <li>
                <a 
                  href={`tel:${PHONE_NUMBER}`} 
                  onClick={trackPhoneClick}
                  className="hover:text-brand-neon transition-colors"
                >
                  {DISPLAY_PHONE}
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-12 border-t border-brand-border flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-brand-muted uppercase tracking-[0.3em] font-bold">
          <p>© 2026 Nokael Dash Logistics </p>
          <div className="flex gap-8">
            <Link to="/privacy" className="hover:text-brand-text transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-text transition-colors">Terms</Link>
            <p>Typically 30-60 min pickup</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

import { StickyCTA } from './StickyCTA';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg selection:bg-brand-neon selection:text-brand-bg">
      {!isDashboard && (
        <header className="fixed top-0 left-0 right-0 z-50">
          <TopBar />
          <Navigation />
        </header>
      )}
      <main className={cn("flex-grow", !isDashboard && "pt-24 sm:pt-20")}>
        {children}
      </main>
      {!isDashboard && <Footer />}
      
      {/* Site-wide Sticky CTA System */}
      {!isDashboard && <StickyCTA />}
    </div>
  );
};
