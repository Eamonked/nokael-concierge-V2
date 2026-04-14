import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Scale } from 'lucide-react';

const LegalLayout = ({ children, title, icon: Icon }: { children: React.ReactNode, title: string, icon: any }) => (
  <div className="bg-brand-bg min-h-screen py-32">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16"
      >
        <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 flex items-center justify-center text-brand-neon mb-8">
          <Icon className="w-6 h-6" />
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-medium tracking-tighter text-brand-text mb-4">{title}</h1>
        <p className="text-brand-muted text-sm uppercase tracking-widest font-bold">Last Updated: April 2024</p>
      </motion.div>
      
      <div className="prose prose-invert prose-brand max-w-none">
        <div className="dispatch-card p-8 md:p-12 space-y-12 text-brand-muted leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  </div>
);

export const TermsAndConditions = () => (
  <LegalLayout title="Terms & Conditions" icon={Scale}>
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">1. Service Definition</h2>
      <p>
        Nokael provides urgent, point-to-point inter-emirate courier services within the United Arab Emirates. We operate as a direct driver assignment network, meaning items are transported directly from pickup to delivery without intermediate sorting or warehousing.
      </p>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">2. Prohibited Items</h2>
      <p>Users are strictly prohibited from requesting the transport of:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Illegal substances or narcotics</li>
        <li>Hazardous, flammable, or explosive materials</li>
        <li>Currency, precious metals, or negotiable instruments</li>
        <li>Perishable goods (unless explicitly agreed upon)</li>
        <li>Any item prohibited by UAE Federal Law</li>
      </ul>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">3. Liability & Insurance</h2>
      <p>
        While Nokael maintains strict chain-of-custody protocols, our liability for loss or damage is limited to the cost of the delivery service unless additional coverage is purchased. We recommend independent insurance for high-value items exceeding AED 5,000.
      </p>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">4. Cancellation Policy</h2>
      <p>
        Cancellations made after a driver has been dispatched to the pickup location will incur a dispatch fee of 50% of the quoted service price.
      </p>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">5. Governing Law</h2>
      <p>
        These terms are governed by the laws of the United Arab Emirates as applied in the Emirate of Dubai.
      </p>
    </section>
  </LegalLayout>
);

export const PrivacyPolicy = () => (
  <LegalLayout title="Privacy Policy" icon={Lock}>
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">1. Information Collection</h2>
      <p>
        We collect information necessary to facilitate your delivery, including:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Name and contact details (Phone, WhatsApp)</li>
        <li>Pickup and delivery addresses</li>
        <li>Company information (for business clients)</li>
        <li>Device information and UTM parameters for marketing optimization</li>
      </ul>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">2. Use of Data</h2>
      <p>
        Your data is used exclusively to:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Assign drivers and coordinate logistics</li>
        <li>Provide real-time tracking updates via WhatsApp</li>
        <li>Process quotes and billing</li>
        <li>Improve our service through conversion analysis</li>
      </ul>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">3. Data Sharing</h2>
      <p>
        We do not sell your personal data. Information is shared only with the assigned driver for the duration of the delivery and with essential service providers (e.g., Supabase for database management, Google for analytics).
      </p>
    </section>

    <section className="space-y-6">
      <h2 className="text-xl font-bold text-brand-text">4. Your Rights</h2>
      <p>
        You have the right to request access to, correction of, or deletion of your personal data held by Nokael. Contact our dispatch team via WhatsApp for any privacy-related inquiries.
      </p>
    </section>
  </LegalLayout>
);
