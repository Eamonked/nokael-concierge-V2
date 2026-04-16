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
import { captureUTMs } from './lib/analytics';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
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

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <UTMCapture />
      <Layout>
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

          {/* Fallback to Home */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </Router>
  );
}