import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import GetQuote from './pages/GetQuote';
import Thankyou from './pages/Thankyou';
import Services from './pages/Services';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { DubaiLanding, AbuDhabiLanding, DocumentLanding, SparePartsLanding } from './pages/LandingPages';
import { TermsAndConditions, PrivacyPolicy } from './pages/Legal';
import BusinessAccountInquiry from './pages/BusinessAccountInquiry';
import DriverApplication from './pages/DriverApplication';
import Track from './pages/Track';
import { captureUTMs, trackPageView } from './lib/analytics';
import NotFound from './pages/NotFound';
import { ErrorBoundary } from 'react-error-boundary';
import { WHATSAPP_NUMBER } from './constants';
import { MessageSquare } from 'lucide-react';


// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Track page views for GTM/Analytics in SPA
function PageViewTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  return null;
}

// Capture UTMs on every route change so they're always picked up,
// even if the user lands on a page other than /get-quote
function UTMCapture() {
  const { search } = useLocation();
  useEffect(() => {
    captureUTMs();
  }, [search]); // re-run if query string changes (e.g. paid click → same-tab navigation)
  return null;
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-display font-medium text-brand-text">Something went wrong</h2>
        <p className="text-brand-muted text-sm leading-relaxed">
          The dispatch system encountered an error. You can continue via WhatsApp for immediate support.
        </p>
        <div className="pt-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full py-4"
          >
            Chat on WhatsApp instead
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-[10px] text-red-500 bg-red-500/5 p-4 rounded-xl text-left overflow-auto max-h-32 border border-red-500/10">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <UTMCapture />
      <PageViewTracker />
      <Layout>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/get-quote" element={<GetQuote />} />
            <Route path="/thank-you" element={<Thankyou />} />
            <Route path="/services" element={<Services />} />
            <Route path="/urgent-delivery-dubai" element={<DubaiLanding />} />
            <Route path="/urgent-delivery-abu-dhabi" element={<AbuDhabiLanding />} />
            <Route path="/document-delivery-uae" element={<DocumentLanding />} />
            <Route path="/spare-parts-delivery-uae" element={<SparePartsLanding />} />
            <Route path="/track" element={<Track />} />
            <Route path="/business-account" element={<BusinessAccountInquiry />} />
            <Route path="/apply-driver" element={<DriverApplication />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            {/* 404 — must be last */}
            <Route path="*" element={<NotFound />} />
            
          </Routes>
        </ErrorBoundary>
      </Layout>
    </Router>
  );
}
