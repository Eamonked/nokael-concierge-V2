import React from 'react';
import { motion } from 'motion/react';
import { Shield, Lock, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Deliberately excluded from the site's bilingual i18n coverage (Phase 13, option A):
// Terms & Privacy stay English-only regardless of site language, rather than being
// machine-translated inline. Both language versions of the site link to this same
// English page. dir="ltr" is forced below so the English prose doesn't inherit
// the document's RTL direction when the site language is Arabic.
const LegalLayout = ({ children, title, icon: Icon, dateLabel = 'Last Updated: April 2024' }: { children: React.ReactNode, title: string, icon: any, dateLabel?: string }) => {
  const { t } = useTranslation('legal');
  return (
  <div dir="ltr" className="bg-brand-bg min-h-screen py-32">
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
        <p className="text-brand-muted text-sm uppercase tracking-widest font-bold">{dateLabel}</p>
        <p className="text-brand-muted text-xs mt-3">{t('englishOnlyNotice')}</p>
      </motion.div>
      
      <div className="prose prose-invert prose-brand max-w-none">
        <div className="dispatch-card p-8 md:p-12 space-y-12 text-brand-muted leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  </div>
  );
};

// Terms content: each section is a heading plus paragraphs (strings), bullet
// lists ({ list }) and numbered sub-headings ({ sub }).
type TermsBlock = string | { list: string[] } | { sub: string };

const TERMS_INTRO = [
  'These Terms & Conditions ("Terms") govern all courier and logistics services provided by Nokael ("Nokael", "we", "us", or "our") to any customer ("Customer", "you", or "your").',
  'By requesting, booking, accepting, or using a Nokael service, the Customer agrees to these Terms.',
];

const TERMS_SECTIONS: { title: string; blocks: TermsBlock[] }[] = [
  { title: 'Service Definition', blocks: [
    'Nokael provides direct, point-to-point courier and logistics services within the United Arab Emirates.',
    'Unless otherwise agreed in writing, shipments are assigned to a driver and transported directly between the agreed pickup and delivery locations without intermediate sorting, warehousing, or consolidation.',
    'The applicable service type, route, rate, scheduled time, vehicle requirements, and any special conditions will be stated in the applicable quotation, booking confirmation, rate agreement, or other written communication accepted by the Customer.',
  ] },
  { title: 'Booking & Service Confirmation', blocks: [
    'A service request becomes a confirmed booking when Nokael accepts the request and confirms the applicable service.',
    'The Customer is responsible for providing accurate and complete information, including:',
    { list: [
      'Pickup and delivery addresses;',
      'Contact names and telephone numbers;',
      'Shipment description;',
      'Number of items;',
      'Approximate dimensions and weight;',
      'Required pickup and delivery times;',
      'Access, security, parking, loading, or site-entry requirements; and',
      'Any special handling requirements.',
    ] },
    'Nokael may revise the applicable service charge where the actual shipment or service requirements materially differ from the information provided at the time of booking.',
  ] },
  { title: 'Pricing & Commercial Arrangements', blocks: [
    'The applicable price for each service will be stated in the quotation, booking confirmation, rate agreement, invoice, or other written commercial communication accepted by the Customer.',
    'Nokael may offer different rates or commercial arrangements based on factors including service frequency, volume, route, timing, recurring business, minimum commitments, reserved capacity, or other agreed conditions.',
    'Where a Customer accepts a minimum service commitment, recurring service arrangement, retainer, reserved capacity, or volume-based pricing arrangement, the applicable commitment and commercial conditions stated in the relevant quotation or agreement form part of the agreement between Nokael and the Customer.',
    'Where a discounted or preferential rate is conditional upon a minimum commitment, the Customer remains responsible for fulfilling that commitment even where the Customer does not use the full agreed volume, unless otherwise stated in writing.',
    'Unused committed services do not automatically carry forward to a subsequent period unless expressly agreed in writing.',
    'Additional services beyond any agreed commitment will be charged according to the applicable agreed rate.',
  ] },
  { title: 'Cancellation & Rescheduling', blocks: [
    { sub: '4.1 Cancellation Before Driver Dispatch' },
    'A Customer may cancel a booking before a driver has been dispatched, subject to any specific cancellation conditions stated in the applicable quotation or agreement.',
    { sub: '4.2 Cancellation After Driver Dispatch' },
    'Where a booking is cancelled after a driver has been dispatched, Nokael may charge a cancellation fee reflecting the costs and resources committed to the service.',
    "The applicable cancellation charge, where different from Nokael's standard cancellation terms, may be stated in the quotation or booking confirmation.",
    { sub: '4.3 Cancellation After Driver Arrival' },
    'Where a booking is cancelled after the driver has arrived at the pickup location, the service may be treated as a completed or failed service and the applicable service charge may become payable.',
    { sub: '4.4 Rescheduling' },
    'Requests to reschedule are subject to operational and driver availability.',
    'Nokael may treat a late rescheduling request as a cancellation where the driver has already been dispatched or the scheduled capacity can no longer reasonably be reassigned.',
    "For bookings forming part of a minimum commitment or reserved-capacity arrangement, rescheduling or cancellation does not automatically remove the Customer's obligation to meet the agreed commitment.",
  ] },
  { title: 'Waiting Time', blocks: [
    'A reasonable waiting period may be included in the applicable service, as stated in the quotation or booking confirmation.',
    'Additional waiting time may be chargeable where the driver is required to wait beyond the included period.',
    'Waiting time begins when the driver arrives at the agreed location and is ready to perform the pickup or delivery.',
    'Waiting time may result from:',
    { list: [
      'The shipment not being ready;',
      'Customer or recipient unavailability;',
      'Security or access procedures;',
      'Loading or unloading;',
      'Missing documentation;',
      'Payment or administrative delays;',
      'Site restrictions;',
      'Delayed authorisation or approval; or',
      'Any other delay attributable to the Customer or recipient.',
    ] },
    "Where excessive waiting materially affects the driver's schedule or ability to perform other services, Nokael may also charge for any additional operational costs reasonably incurred.",
  ] },
  { title: 'Failed Pickup or Delivery', blocks: [
    'A pickup or delivery may be treated as unsuccessful where:',
    { list: [
      'The shipment is not ready when the driver arrives;',
      'The Customer or recipient is unavailable;',
      'Access to the location is denied or unavailable;',
      'Required documentation or approvals are unavailable;',
      'The address or contact information provided is incorrect;',
      'The shipment materially differs from the information provided at booking;',
      'The recipient refuses or is unable to accept the shipment; or',
      'The Customer otherwise prevents the service from being completed.',
    ] },
    'A failed pickup or delivery may be charged as a completed service, together with any applicable waiting, return, redirection, additional-distance, or other operational charges.',
  ] },
  { title: 'Changes to a Confirmed Booking', blocks: [
    'Changes to a confirmed booking may result in additional charges or revised service conditions.',
    'Changes include, but are not limited to:',
    { list: [
      'Pickup location;',
      'Delivery location;',
      'Route;',
      'Number or type of items;',
      'Vehicle requirements;',
      'Pickup or delivery time;',
      'Additional stops;',
      'Special handling requirements; or',
      'Delivery instructions.',
    ] },
    'Nokael is not obligated to accept material changes that were not included in the original booking.',
    'Where reasonably possible, Nokael will advise the Customer of any additional charges before proceeding with a material change.',
  ] },
  { title: 'Prohibited & Restricted Items', blocks: [
    'The Customer must not request Nokael to transport:',
    { list: [
      'Illegal substances or narcotics;',
      'Explosives;',
      'Firearms, ammunition, or prohibited weapons;',
      'Hazardous, radioactive, flammable, toxic, or otherwise dangerous materials;',
      'Currency, cash, precious metals, or negotiable instruments unless expressly accepted by Nokael in writing;',
      'Perishable goods unless expressly agreed in advance;',
      'Live animals unless expressly agreed in advance;',
      'Items requiring specialist handling unless expressly agreed; or',
      'Any item whose possession, transportation, or delivery is prohibited or restricted under applicable UAE law.',
    ] },
    'The Customer is responsible for accurately declaring the contents of every shipment.',
    'Nokael reserves the right to refuse, stop, inspect where legally permitted, or return a shipment where there is reasonable concern that its contents are prohibited, dangerous, incorrectly declared, or unsuitable for transportation.',
    'Where a prohibited or incorrectly declared shipment has already been collected, the Customer remains responsible for any resulting costs, delays, returns, penalties, or other reasonable expenses, subject to applicable law.',
  ] },
  { title: 'Packaging & Shipment Condition', blocks: [
    'The Customer is responsible for ensuring that all shipments are properly packaged, sealed, labelled, and suitable for transportation.',
    'Packaging must be sufficient to protect the shipment during normal handling and transportation.',
    'Nokael may refuse a shipment that is inadequately packaged or presents a risk to the driver, vehicle, property, or other persons.',
    'Unless expressly agreed, Nokael does not provide specialist packaging, crating, temperature-controlled transportation, or hazardous-material handling.',
  ] },
  { title: 'Shipment Value & Insurance', blocks: [
    'The Customer is responsible for accurately declaring the nature and value of the shipment where requested.',
    'Customers transporting high-value, fragile, sensitive, or commercially critical items are responsible for arranging appropriate insurance unless additional coverage has been expressly agreed with Nokael in writing.',
    'Nokael may decline a shipment where its value, nature, risk, or insurance requirements are not reasonably acceptable for the requested service.',
  ] },
  { title: 'Liability & Loss or Damage', blocks: [
    'Nokael will exercise reasonable care in handling and transporting accepted shipments.',
    "Subject to applicable UAE law and any liability that cannot legally be excluded or limited, Nokael's liability for loss or damage will be limited to the extent stated in the applicable quotation, booking confirmation, service agreement, or other agreed commercial terms.",
    "Where no specific limitation has been agreed, Nokael's liability will be determined in accordance with applicable law.",
    'Nokael will not be responsible for loss or damage resulting from:',
    { list: [
      'Inadequate or defective packaging;',
      'Incorrect or incomplete information supplied by the Customer;',
      'The inherent nature of the shipment;',
      'Prohibited or incorrectly declared items;',
      'Actions or omissions of the Customer or recipient; or',
      "Circumstances outside Nokael's reasonable control,",
    ] },
    'except to the extent otherwise required by applicable law.',
  ] },
  { title: 'Delivery Times & Delays', blocks: [
    'Nokael will use reasonable efforts to perform services within the agreed or estimated timeframe.',
    "Unless expressly confirmed by Nokael in writing as a guaranteed service commitment, delivery times are estimates and may be affected by traffic, road conditions, access restrictions, security procedures, loading or unloading delays, weather, government restrictions, accidents, or other circumstances outside Nokael's reasonable control.",
    'A delay does not automatically constitute a failure to provide the service or entitle the Customer to a refund or compensation unless otherwise agreed or required by applicable law.',
  ] },
  { title: 'Driver & Vehicle', blocks: [
    'Nokael may assign an appropriate driver and vehicle based on the shipment information and service requirements provided by the Customer.',
    'Nokael may substitute the assigned driver or vehicle where reasonably necessary to complete the service.',
    "The Customer must not require a driver to transport a shipment that exceeds the vehicle's safe capacity or applicable legal limits.",
    'Drivers are not required to perform unsafe loading, unloading, lifting, handling, or transportation activities.',
    'The Customer is responsible for ensuring that loading and unloading locations are reasonably accessible and safe.',
  ] },
  { title: 'Additional Charges & Expenses', blocks: [
    'Additional charges may apply where a service requires resources or work outside the original booking.',
    'These may include:',
    { list: [
      'Additional waiting time;',
      'Additional pickup or delivery locations;',
      'Redirection;',
      'Return to sender;',
      'Failed delivery;',
      'Incorrect address;',
      'Additional distance;',
      'Additional vehicle requirements;',
      'Special handling;',
      'Parking or access charges;',
      'Tolls or permits where applicable; or',
      'Other services requested by the Customer.',
    ] },
    'Where reasonably possible, Nokael will obtain Customer approval before incurring material additional charges.',
    'Where prior approval is not reasonably possible because immediate action is required to protect the shipment, driver, vehicle, or service, Nokael may take reasonable steps and charge the resulting reasonable costs.',
  ] },
  { title: 'Proof of Delivery', blocks: [
    'Nokael may provide proof of delivery through electronic confirmation, OTP, signature, photograph, timestamp, GPS/location information, or another reasonable method.',
    'Proof of delivery may be retained and used for service verification, invoicing, customer support, quality control, and dispute resolution.',
  ] },
  { title: 'Customer Responsibilities', blocks: [
    'The Customer is responsible for:',
    { list: [
      'The legality and accurate declaration of every shipment;',
      'Proper packaging and preparation;',
      'Accurate pickup and delivery information;',
      'Providing accurate contact information;',
      'Ensuring authorised persons are available for pickup and delivery;',
      'Obtaining required permits, approvals, and documentation;',
      'Informing Nokael of special handling, access, or security requirements;',
      'Ensuring the pickup and delivery locations are reasonably accessible; and',
      'Paying all applicable charges.',
    ] },
    'The Customer is responsible for the actions and omissions of its employees, representatives, agents, contractors, and nominated recipients in connection with the service.',
  ] },
  { title: 'Payment', blocks: [
    'Unless otherwise agreed in writing, invoices are payable according to the payment terms stated in the applicable quotation or invoice.',
    'Nokael may require prepayment, deposits, credit limits, or other payment arrangements depending on the Customer, service, or commercial arrangement.',
    'Where a Customer has agreed to a minimum commitment, recurring service arrangement, retainer, or reserved capacity arrangement, the applicable commitment remains payable according to the agreed billing terms.',
    'Late or overdue payments may result in suspension of services.',
    'Nokael reserves the right to require prepayment or revised payment terms where an account has overdue balances.',
  ] },
  { title: 'Claims & Service Disputes', blocks: [
    'Any claim relating to loss, damage, delay, incorrect delivery, or service performance should be reported to Nokael as soon as reasonably practicable.',
    'Where possible, claims relating to loss, damage, or delivery discrepancies should be reported within 48 hours of delivery or the scheduled completion of the service.',
    'The Customer must provide sufficient information and supporting documentation to allow Nokael to investigate the matter.',
    'Nothing in this section limits any rights the Customer may have under applicable law.',
  ] },
  { title: 'Force Majeure', blocks: [
    "Nokael will not be responsible for failure or delay in performing a service where the failure or delay results from circumstances beyond Nokael's reasonable control.",
    'Such circumstances may include, but are not limited to:',
    { list: [
      'Severe traffic disruption;',
      'Road closures;',
      'Accidents involving third parties;',
      'Government restrictions;',
      'Security restrictions;',
      'Extreme weather;',
      'Natural events;',
      'Strikes;',
      'Civil disturbances;',
      'Changes in law or regulation; or',
      "Other events beyond Nokael's reasonable control.",
    ] },
    'Where reasonably practical, Nokael will notify the Customer of material disruptions and take reasonable steps to minimise their impact.',
  ] },
  { title: 'Suspension or Refusal of Service', blocks: [
    'Nokael may refuse, suspend, or terminate a service where:',
    { list: [
      'The shipment is prohibited or presents an unreasonable risk;',
      'The Customer provides materially inaccurate information;',
      'The Customer fails to make required payment;',
      'The service would require unlawful or unsafe conduct;',
      'The Customer or recipient behaves abusively, threateningly, or dangerously toward Nokael personnel; or',
      'Continuing the service would expose Nokael, its drivers, vehicles, or other persons to unreasonable risk.',
    ] },
    'Where practicable, Nokael will notify the Customer of the reason for refusal or suspension.',
  ] },
  { title: 'Data & Service Records', blocks: [
    'Nokael may collect and retain information reasonably necessary to provide, administer, verify, invoice, and improve its services.',
    'This may include booking information, contact details, delivery confirmations, photographs, timestamps, location information, and communications relating to the service.',
    'Nokael may retain service records for operational, accounting, customer-service, compliance, and dispute-resolution purposes, subject to applicable law.',
  ] },
  { title: 'Governing Law', blocks: [
    'These Terms are governed by the applicable laws of the United Arab Emirates and, where applicable, the laws and regulations of the Emirate in which the relevant Nokael service is provided or contracted.',
    'Any dispute arising from or relating to these Terms shall be subject to the jurisdiction of the competent courts of the applicable Emirate, unless otherwise agreed in writing or required by applicable law.',
  ] },
  { title: 'Amendments', blocks: [
    'Nokael may update these Terms from time to time.',
    'The Terms applicable to a particular booking are those accepted by the Customer at the time of booking, unless otherwise agreed in writing.',
    'Any specific commercial terms stated in a quotation, proposal, booking confirmation, or service agreement accepted by the Customer will apply to that service.',
    'Where there is a conflict between these standard Terms and an expressly agreed written commercial term, the expressly agreed term will govern to the extent of that conflict.',
  ] },
  { title: 'Acceptance', blocks: [
    'By requesting, booking, accepting, or using a Nokael service, the Customer acknowledges that they have read, understood, and agreed to these Terms.',
  ] },
];

export const TermsAndConditions = () => (
  <LegalLayout title="Terms & Conditions" icon={Scale} dateLabel="Effective Date: 29 September 2026">
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-brand-text">Nokael Courier &amp; Logistics Services</h2>
      {TERMS_INTRO.map(text => <p key={text}>{text}</p>)}
    </section>

    {TERMS_SECTIONS.map((section, i) => (
      <section key={section.title} className="space-y-4">
        <h2 className="text-xl font-bold text-brand-text">{i + 1}. {section.title}</h2>
        {section.blocks.map((block, j) =>
          typeof block === 'string' ? (
            <p key={j}>{block}</p>
          ) : 'sub' in block ? (
            <h3 key={j} className="text-base font-semibold text-brand-text pt-2">{block.sub}</h3>
          ) : (
            <ul key={j} className="list-disc pl-6 space-y-2">
              {block.list.map(item => <li key={item}>{item}</li>)}
            </ul>
          )
        )}
      </section>
    ))}

    <section className="space-y-1">
      <p className="font-bold text-brand-text">Nokael</p>
      <p>Business Courier &amp; Logistics Services</p>
      <p>United Arab Emirates</p>
      <p>Website: <a href="https://www.nokael.com" className="text-brand-neon hover:underline">nokael.com</a></p>
      <p>Email: <a href="mailto:info@nokael.com" className="text-brand-neon hover:underline">info@nokael.com</a></p>
      <p>Telephone: <a href="tel:+971509710446" className="text-brand-neon hover:underline">+971 50 971 0446</a></p>
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
