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
    <div className="bg-brand-neon text-brand-bg py-2.5 px-4 relative z-[60]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-bold">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-bg" />
            Urgent Dispatch Active
          </span>
          <span className="hidden md:inline opacity-60">|</span>
          <span className="hidden md:inline">Dubai ↔ Abu Dhabi • 90-120 min delivery</span>
        </div>
        <div className="flex items-center gap-6">
          <a href={`tel:${PHONE_NUMBER}`} onClick={() => trackPhoneClick('top_bar')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Phone className="w-3.5 h-3.5 fill-brand-bg" />
            <span>{DISPLAY_PHONE}</span>
          </a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsAppClick('top_bar')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <MessageSquare className="w-3.5 h-3.5 fill-brand-bg" />
            <span>WhatsApp</span>
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
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded overflow-hidden border border-brand-border transition-transform group-hover:scale-105">
              <img src="/logo.svg" alt="Nokael Logo" width="36" height="36" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="text-xl font-display font-medium tracking-tighter uppercase">
              Nokael<span className="text-brand-neon">.</span>
            </span>
          </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/services"
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-brand-neon",
                  location.pathname === "/services" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Routes
              </Link>
              <Link
                to="/about"
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-brand-neon",
                  location.pathname === "/about" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                About
              </Link>
              <Link
                to="/get-quote"
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-brand-neon",
                  location.pathname === "/get-quote" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Book Now
              </Link>
              <Link
                to="/track"
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-brand-neon",
                  location.pathname === "/track" ? "text-brand-neon" : "text-brand-muted"
                )}
              >
                Track
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-4 border-l border-brand-border pl-8">
              <ThemeToggle />
              <Link
                to="/get-quote"
                className="px-6 py-2.5 bg-brand-neon text-brand-bg font-bold rounded-xl text-sm hover:opacity-90 transition-all shadow-lg shadow-brand-neon/20"
              >
                Book Now
              </Link>
            </div>

            {/* Mobile Toggle */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <button
               className="p-2 text-brand-muted hover:text-brand-text transition-colors"
               onClick={() => setIsOpen(!isOpen)}
               aria-label="Toggle Menu"
               aria-expanded={isOpen}
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
                className="block text-2xl font-display font-medium tracking-tight hover:text-brand-neon transition-colors"
              >
                Routes
              </Link>
              <Link
                to="/about"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tight hover:text-brand-neon transition-colors"
              >
                About
              </Link>
              <Link
                to="/get-quote"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tight hover:text-brand-neon transition-colors"
              >
                Book Now
              </Link>
              <Link
                to="/track"
                onClick={() => setIsOpen(false)}
                className="block text-2xl font-display font-medium tracking-tight hover:text-brand-neon transition-colors"
              >
                Track
              </Link>
              <div className="pt-6 grid grid-cols-1 gap-4">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('mobile_nav')}
                  className="btn-primary w-full"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${PHONE_NUMBER}`}
                  onClick={() => trackPhoneClick('mobile_nav')}
                  className="btn-secondary w-full"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Now</span>
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
            <Link to="/" className="flex items-center gap-3 mb-8 group">
              <div className="w-8 h-8 rounded overflow-hidden border border-brand-border transition-transform group-hover:scale-105">
                <img src="/logo.svg" alt="Nokael Logo" width="32" height="32" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="text-lg font-display font-medium tracking-tight">
                Nokael<span className="text-brand-neon">.</span>
              </span>
            </Link>
            <p className="text-brand-muted max-w-sm leading-relaxed mb-10 text-sm">
              Same-day delivery between Dubai and Abu Dhabi. One driver, straight to the destination, no sorting hubs.
            </p>
            <div className="flex items-center gap-3 px-3 py-2 rounded-full bg-brand-surface border border-brand-border inline-flex">
              <div className="w-2 h-2 rounded-full bg-brand-neon" />
              <span className="text-xs font-semibold text-brand-text">Operational</span>
            </div>
          </div>
          
          <div className="md:col-span-3">
            <h2 className="text-brand-text font-bold text-xs uppercase tracking-wider mb-8">Quick Links</h2>
            <ul className="space-y-4 text-sm text-brand-muted">
              <li>
                <Link to="/urgent-delivery-dubai" className="hover:text-brand-neon transition-colors">Dubai Same-Day</Link>
              </li>
              <li>
                <Link to="/urgent-delivery-abu-dhabi" className="hover:text-brand-neon transition-colors">Abu Dhabi Urgent</Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-brand-neon transition-colors">All Routes</Link>
              </li>
              <li>
                <Link to="/document-delivery-uae" className="hover:text-brand-neon transition-colors">Document Delivery</Link>
              </li>
              <li>
                <Link to="/spare-parts-delivery-uae" className="hover:text-brand-neon transition-colors">Parts Delivery</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-brand-neon transition-colors">About</Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h2 className="text-brand-text font-bold text-xs uppercase tracking-wider mb-8">Contact</h2>
            <ul className="space-y-4 text-sm text-brand-muted">
              <li><Link to="/track" className="hover:text-brand-neon transition-colors">Track Order</Link></li>
              <li><Link to="/get-quote" className="hover:text-brand-neon transition-colors">Get Quote</Link></li>
              <li><Link to="/business-account" className="hover:text-brand-neon transition-colors">Business Accounts</Link></li>
              <li><Link to="/apply-driver" className="hover:text-brand-neon transition-colors">Driver Application</Link></li>
              <li>
                <a 
                  href={`https://wa.me/${WHATSAPP_NUMBER}`} 
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsAppClick('footer')}
                  className="hover:text-brand-neon transition-colors inline-flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </li>
              <li>
                <a 
                  href={`tel:${PHONE_NUMBER}`} 
                  onClick={() => trackPhoneClick('footer')}
                  className="hover:text-brand-neon transition-colors inline-flex items-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{DISPLAY_PHONE}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-12 border-t border-brand-border flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-brand-muted font-medium">
          <p>© 2026 Nokael Dash Logistics</p>
          <div className="flex gap-8">
            <Link to="/privacy" className="hover:text-brand-text transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-text transition-colors">Terms</Link>
            <p>Pickup typically 30-60 min</p>
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
