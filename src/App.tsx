import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import GetQuote from './pages/GetQuote';
import Services from './pages/Services';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { DubaiLanding, AbuDhabiLanding, DocumentLanding, SparePartsLanding } from './pages/LandingPages';
import Track from './pages/Track';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/get-quote" element={<GetQuote />} />
          <Route path="/services" element={<Services />} />
          <Route path="/urgent-delivery-dubai" element={<DubaiLanding />} />
          <Route path="/urgent-delivery-abu-dhabi" element={<AbuDhabiLanding />} />
          <Route path="/document-delivery-uae" element={<DocumentLanding />} />
          <Route path="/spare-parts-delivery-uae" element={<SparePartsLanding />} />
          <Route path="/track" element={<Track />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          
          {/* Fallback to Home */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </Router>
  );
}
