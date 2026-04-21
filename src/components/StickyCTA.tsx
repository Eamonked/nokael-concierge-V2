import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Phone, Zap, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { WHATSAPP_NUMBER, PHONE_NUMBER } from '../constants';
import { trackWhatsAppClick, trackPhoneClick } from '../lib/analytics';

export const StickyCTA = () => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const { pathname } = useLocation();

  // Hide CTA on specific pages if needed (e.g., login, dashboard)
  const isExcludedPage = pathname === '/login' || pathname === '/dashboard';

  React.useEffect(() => {
    const handleScroll = () => {
      // Show CTA after scrolling 100px (was 300px)
      if (window.scrollY > 100) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isExcludedPage) return null;

  return (
    <>
      {/* Desktop Floating CTA */}
      <div className="hidden md:block fixed bottom-8 right-8 z-[100]">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative"
            >
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick('sticky_floating')}
                className="flex items-center gap-3 bg-brand-neon text-brand-bg px-6 py-3.5 rounded-full shadow-[0_20px_50px_rgba(57,255,20,0.2)] hover:shadow-[0_20px_50px_rgba(57,255,20,0.4)] transition-all duration-500 group overflow-hidden"
              >
                <div className="relative z-10 flex items-center gap-3">
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 fill-current group-hover:opacity-0 transition-opacity duration-300" />
                    <Zap className="w-4 h-4 absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 fill-current" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">WhatsApp Dispatch</span>
                  
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="overflow-hidden whitespace-nowrap border-l border-brand-bg/20 pl-3 ml-1"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Quote in &lt;2 min</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Subtle background pulse */}
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Sticky Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4 pointer-events-none">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="pointer-events-auto"
            >
              <div className="bg-brand-bg/80 backdrop-blur-xl border border-brand-border rounded-2xl p-1.5 flex items-center gap-2 shadow-2xl">
                 <a
                   href={`tel:${PHONE_NUMBER}`}
                   onClick={trackPhoneClick}
                   className="w-12 h-12 flex items-center justify-center bg-brand-input text-brand-text rounded-xl border border-brand-input-border active:scale-95 transition-transform"
                   aria-label="Call Dispatch"
                 >
                   <Phone className="w-4 h-4" />
                 </a>
                 <a
                   href={`https://wa.me/${WHATSAPP_NUMBER}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   onClick={() => trackWhatsAppClick('sticky_mobile_bar')}
                   className="flex-1 h-12 flex items-center justify-center gap-3 bg-brand-neon text-brand-bg rounded-xl font-black uppercase tracking-widest text-[9px] active:scale-[0.98] transition-transform shadow-[0_10px_30px_rgba(57,255,20,0.2)]"
                   aria-label="Request Dispatch via WhatsApp"
                 >
                   <MessageSquare className="w-4 h-4 fill-current" />
                   <span>Request via WhatsApp</span>
                 </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
