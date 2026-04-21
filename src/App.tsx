import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';

// Code splitting for improved performance/LCP/TBT
const GetQuote = lazy(() => import('./pages/GetQuote'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));
const Thankyou = lazy(() => import('./pages/Thankyou'));
const Services = lazy(() => import('./pages/Services'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const BusinessAccountInquiry = lazy(() => import('./pages/BusinessAccountInquiry'));
const DriverApplication = lazy(() => import('./pages/DriverApplication'));
const About = lazy(() => import('./pages/About'));
const Track = lazy(() => import('./pages/Track'));
const NotFound = lazy(() => import('./pages/NotFound'));

import { DubaiLanding, AbuDhabiLanding, DocumentLanding, SparePartsLanding } from './pages/LandingPages';
import { TermsAndConditions, PrivacyPolicy } from './pages/Legal';
import { captureUTMs, trackPageView } from './lib/analytics';
import { ErrorBoundary } from 'react-error-boundary';
import { WHATSAPP_NUMBER } from './constants';
import { MessageSquare } from 'lucide-react';
import { SEO_METADATA, DEFAULT_METADATA } from '../seo/metadata';

// Loading Fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-bg">
    <div className="w-8 h-8 border-2 border-brand-neon border-t-transparent rounded-full animate-spin" />
  </div>
);

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

// Manages browser tab titles in the SPA
function TitleManager() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    // Standardize path: remove trailing slash
    const urlPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    const metadata = SEO_METADATA[urlPath] || DEFAULT_METADATA;
    
    if (metadata?.title) {
      document.title = metadata.title;
      console.log(`[SEO] Title updated to: ${metadata.title} for path: ${urlPath}`);
    } else {
      console.warn(`[SEO] No title found for path: ${urlPath}`);
    }
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <UTMCapture />
      <PageViewTracker />
      <TitleManager />
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/get-quote" element={
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                  <GetQuote />
                </ErrorBoundary>
              } />
              <Route path="/thank-you" element={<Thankyou />} />
              <Route path="/services" element={<Services />} />
              <Route path="/urgent-delivery-dubai" element={<DubaiLanding />} />
              <Route path="/urgent-delivery-abu-dhabi" element={<AbuDhabiLanding />} />
              <Route path="/document-delivery-uae" element={<DocumentLanding />} />
              <Route path="/spare-parts-delivery-uae" element={<SparePartsLanding />} />
              <Route path="/track" element={<Track />} />
              <Route path="/business-account" element={<BusinessAccountInquiry />} />
              <Route path="/apply-driver" element={<DriverApplication />} />
              <Route path="/about" element={<About />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/confirm/:token/:action" element={<ConfirmationPage />} />
              <Route path="/login" element={<Login />} />
              {/* 404 — must be last */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}
