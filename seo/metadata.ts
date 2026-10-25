export interface PageMetadata {
  title: string;
  description: string;
  h1: string;
  content: string;
  faqs?: { q: string; a: string }[];
  price?: string;
  zones?: string[];
  sla?: string;
  breadcrumb?: { name: string; url: string }[];
}

// Answers every service page shares. Keep in step with public/llms.txt.
const CORE_FAQS: { q: string; a: string }[] = [
  {
    q: "How much does Nokael cost?",
    a: "Every booking is quoted per route before dispatch: one vehicle and one driver per job, with no shared loads. The price depends on the route, how urgent it is and the item. Request a quote or message dispatch on WhatsApp for current rates.",
  },
  {
    q: "How do I know my item was handed over to the right person?",
    a: "Custody changes hands with one-time codes. The sender gives the driver a code at pickup, and the recipient confirms delivery with their own code. Every handover is recorded with the time and GPS location.",
  },
  {
    q: "What is a Chain of Custody certificate?",
    a: "A record Nokael sends after delivery showing who held your item, where and when: each handover with time and GPS, plus the total time in custody. Law firms and finance teams keep it as proof of delivery.",
  },
  {
    q: "Can I track the delivery live?",
    a: "Yes. You get a live tracking link showing the driver on the map and the estimated arrival time.",
  },
  {
    q: "How fast can a driver pick up?",
    a: "A named driver is assigned within minutes of confirmation. Pickup is usually within 30–60 minutes in major business areas of Dubai and Abu Dhabi.",
  },
  {
    q: "Are you available at night and on weekends?",
    a: "Yes. Dispatch runs 24/7.",
  },
];

export const SEO_METADATA: Record<string, PageMetadata> = {
  "/": {
    title: "Same-Day Courier Dubai ↔ Abu Dhabi with Chain of Custody | Nokael",
    description:
      "Urgent same-day courier between Dubai and Abu Dhabi. One named driver per job, no sorting hubs, one-time codes at pickup and delivery, and a Chain of Custody certificate.",
    h1: "Same-Day Courier Dubai ↔ Abu Dhabi: One Driver, Proof at Every Handover",
    content: `Dedicated driver. No hubs. Immediate dispatch. We provide same-day Dedicated Executive Transit services from Dubai to Abu Dhabi, including express document delivery, urgent parcel transport, and dedicated business logistics across the UAE.
      Nokael provides urgent same-day business logistics services between Dubai and Abu Dhabi. We offer direct driver assignment, no warehouses, and no sorting hubs for your time-critical documents, parcels, and spare parts.
      Whether it is a legal tender, a sensitive contract, or an emergency spare part, our dedicated drivers ensure your items reach their destination safely and on time.`,
    sla: "90-120 min delivery",
    zones: ["DIFC", "Downtown Dubai", "Jebel Ali", "Abu Dhabi Global Market", "Mussafah"],
    faqs: [
      {
        q: "How fast is the delivery between Dubai and Abu Dhabi?",
        a: "Transit is usually 90–120 minutes, depending on traffic and the pickup location. The driver goes straight there with no hub stops.",
      },
      ...CORE_FAQS,
      {
        q: "How is Nokael different from a normal courier?",
        a: "Normal couriers route items through sorting hubs and shared vans. Nokael assigns one driver to your item only, drives it directly to the recipient, and records every handover.",
      },
    ],
    breadcrumb: [{ name: "Home", url: "/" }],
  },

  "/urgent-delivery-dubai": {
    title: "Urgent Same-Day Courier from Dubai | Nokael",
    description:
      "Urgent same-day courier from Dubai to Abu Dhabi and every emirate. Pickup usually within 30–60 minutes, one dedicated driver, live tracking and Chain of Custody.",
    h1: "Urgent Same-Day Courier from Dubai.",
    content: `Fast inter-emirate transport starting from Dubai. Pickup typically within 30–60 minutes for immediate dispatch to Abu Dhabi, Sharjah, and beyond. Built for businesses that cannot afford logistics delays.
      Nokael provides a direct-response dispatch system for companies and individuals in Dubai who need items moved to other emirates immediately.
      Our drivers are strategically positioned across Dubai—from Downtown and DIFC to Jebel Ali and Dubai Marina—to ensure rapid response times. We don't use sorting hubs; your item goes from the pickup point directly to the delivery destination.`,
    sla: "30-60 min pickup",
    zones: ["DIFC", "Downtown", "Business Bay", "JLT", "Jebel Ali", "Dubai Marina"],
    faqs: [
      {
        q: "What areas in Dubai do you cover?",
        a: "All of Dubai, including DIFC, Downtown, Business Bay, JLT, Dubai Marina and Jebel Ali.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Urgent Delivery Dubai", url: "/urgent-delivery-dubai" },
    ],
  },

  "/urgent-delivery-abu-dhabi": {
    title: "Urgent Same-Day Courier from Abu Dhabi | Nokael",
    description:
      "Urgent same-day courier from Abu Dhabi to Dubai and the Northern Emirates. One dedicated driver, no hubs, live tracking and a Chain of Custody certificate.",
    h1: "Urgent Same-Day Courier from Abu Dhabi.",
    content: `Premium inter-emirate logistics from the capital. Dedicated drivers for direct transport to Dubai and the Northern Emirates. Serving government, corporate, and private clients with precision.
      Abu Dhabi requires a higher level of logistics precision. Nokael serves the capital's most demanding delivery needs, providing dedicated transport for government, corporate, and private clients.
      Our Abu Dhabi dispatch network covers the entire city, including Al Reem Island, Khalifa City, and the Industrial areas. We specialize in the Abu Dhabi ↔ Dubai corridor, offering the fastest possible transit times between the two major hubs.`,
    sla: "30-60 min pickup",
    zones: ["Al Reem Island", "Khalifa City", "Mussafah", "ADGM", "Corniche"],
    faqs: [
      {
        q: "Can you deliver from Abu Dhabi to the Northern Emirates?",
        a: "Yes, we provide direct delivery from Abu Dhabi to Sharjah, Ajman, RAK, and Fujairah.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Urgent Delivery Abu Dhabi", url: "/urgent-delivery-abu-dhabi" },
    ],
  },

  "/document-delivery-uae": {
    title: "Urgent B2B Legal & Corporate Document Delivery UAE | Nokael",
    description:
      "Secure urgent document transit for UAE legal tenders and corporate contracts. Hand-to-hand B2B Dedicated Executive Transit with a dedicated driver and direct chain of custody.",
    h1: "Urgent Legal & Corporate Document Dispatch.",
    content: `Secure, hand-to-hand transport for sensitive legal documents, contracts, and government tenders across all emirates. A dedicated driver, one-time codes at pickup and delivery, a live tracking link, and a Chain of Custody certificate with time and GPS for every handover.
      In the B2B logistics world, some documents are too critical for standard courier networks. Nokael provides a premium dispatch service that prioritizes security and direct accountability.
      Our drivers handle your sensitive materials with the utmost care, providing hand-to-hand Dedicated Executive Transit from the sender directly to the recipient. We understand the critical nature of legal deadlines and government tender submissions.`,
    sla: "Hand-to-hand security",
    zones: ["All UAE Courts", "Free Zones", "Government Offices", "Embassies"],
    faqs: [
      {
        q: "Is the document delivery secure?",
        a: "Yes. One dedicated driver carries the document hand to hand, the sender and recipient each confirm with a one-time code, and every handover is recorded with time and GPS.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Document Delivery UAE", url: "/document-delivery-uae" },
    ],
  },

  "/legal-document-courier-uae": {
    title: "Legal Document Courier for Law Firms in the UAE | Nokael",
    description:
      "Same-day legal document courier for law firms in DIFC, ADGM and across the UAE. One named driver, one-time codes at every handover, and a Chain of Custody certificate for the file.",
    h1: "Legal Document Courier for Law Firms: DIFC, ADGM and Across the UAE",
    content: `Same-day, hand-to-hand delivery of contracts, court filings, powers of attorney and title deeds. One named driver carries the document straight from your office to the recipient: DIFC to ADGM, a court registry, a notary or a client's office.
      Custody changes hands with one-time codes: your team gives the driver a code at pickup, and the recipient confirms delivery with their own code. Each handover is recorded with time and GPS, and you can follow the run on a live tracking link.
      After delivery you receive a Chain of Custody certificate showing who held the document, where and when, and the total time in custody. Download a sample certificate on this page.`,
    sla: "Pickup usually within 30–60 min",
    zones: ["DIFC", "ADGM", "Dubai Courts", "Abu Dhabi Judicial Department", "Notaries", "Free Zones"],
    faqs: [
      {
        q: "Can you deliver from DIFC to ADGM the same day?",
        a: "Yes. A dedicated driver goes straight from DIFC to ADGM, usually in 90–120 minutes depending on traffic.",
      },
      {
        q: "What legal documents do you carry?",
        a: "Signed contracts, court filings, powers of attorney, title deeds, NOC letters, tender submissions and other originals that must be hand-delivered.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Legal Document Courier", url: "/legal-document-courier-uae" },
    ],
  },

  "/spare-parts-delivery-uae": {
    title: "Urgent Spare Parts Delivery UAE | Nokael",
    description:
      "Emergency spare parts logistics across the UAE for industrial needs. Direct from supplier to site with 24/7 dispatch.",
    h1: "Urgent Spare Parts Logistics.",
    content: `Emergency transport for critical machinery, automotive, and industrial parts. Direct from supplier to site. 24/7 emergency dispatch for industrial hardware across the UAE.
      When machinery breaks down or a vehicle is off the road, every minute costs money. Nokael provides emergency spare parts logistics for the industrial and automotive sectors across the UAE.
      We specialize in the rapid transport of critical components that are too urgent for traditional freight. Our drivers can pick up directly from suppliers or warehouses straight to the site where the part is needed.`,
    sla: "Immediate site logistics",
    zones: ["Industrial Areas", "Construction Sites", "Workshops", "Ports"],
    faqs: [
      {
        q: "Do you handle heavy spare parts?",
        a: "We handle items that can fit in a standard vehicle. For larger items, please contact us for a custom quote.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Spare Parts Delivery UAE", url: "/spare-parts-delivery-uae" },
    ],
  },

  "/services": {
    title: "Direct Response Logistics Services | Nokael UAE",
    description:
      "Specialized urgent delivery services across the UAE including documents, spare parts, and inter-emirate corridors. Built for speed and security.",
    h1: "Direct Response Logistics Services.",
    content: `We provide specialized, high-speed transport solutions across the UAE. Built for speed, security, and direct accountability. Our services include urgent inter-emirate delivery, document & legal transport, and spare parts logistics.
      Traditional courier services rely on sorting hubs and shared vehicle loads. We bypass the traditional warehouse model entirely. One driver, one item, one direct route. We eliminate the friction of traditional logistics.`,
    sla: "Point-to-point delivery",
    zones: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "RAK", "Fujairah", "UAQ"],
    faqs: [
      {
        q: "What services do you offer?",
        a: "We offer urgent inter-emirate delivery, document and legal transport, and spare parts logistics.",
      },
      ...CORE_FAQS,
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
    ],
  },

  "/get-quote": {
    title: "Request Dedicated Executive Transit Quote | Nokael UAE Dispatch",
    description: "Get a quote for an urgent same-day document or parcel delivery between Dubai, Abu Dhabi and all emirates. Every route is quoted before dispatch.",
    h1: "Request an Immediate Quote.",
    content: "Our dispatch system provides instant routing and driver assignment for urgent logistics across the UAE. Fill out the route and item details for a dedicated dispatch.",
    sla: "Driver assigned in minutes",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Request Quote", url: "/get-quote" },
    ],
  },

  "/track": {
    title: "Track Live Delivery & Chain of Custody | Nokael",
    description: "Track your active shipment, pilot location, and digital chain of custody (COC) verification in real-time across the UAE.",
    h1: "Live Shipment Tracking & Chain of Custody",
    content: "Real-time GPS telemetry and tamper-proof chain of custody verification for urgent business shipments between Dubai and Abu Dhabi.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Track", url: "/track" },
    ],
  },

  "/business-account": {
    title: "Corporate Logistics Account | Nokael B2B Transit",
    description: "Open a corporate logistics account for priority vehicle dispatch, monthly consolidated billing, and dedicated corridor rates.",
    h1: "Corporate Logistics Account",
    content: "Priority vehicle assignment and simplified monthly invoicing for high-frequency B2B corridors across the UAE.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Business Account", url: "/business-account" },
    ],
  },

  "/apply-driver": {
    title: "Join Nokael Driver Network | UAE Logistics",
    description: "Apply to join Nokael's vetted pilot network for executive point-to-point deliveries across Dubai, Abu Dhabi, and all emirates.",
    h1: "Join the Nokael Pilot Network",
    content: "We partner with professional, licensed drivers across the UAE for dedicated courier missions.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Driver Application", url: "/apply-driver" },
    ],
  },

  "/about": {
    title: "About Nokael | Same-Day Courier Dubai to Abu Dhabi",
    description: "Learn about Nokael's direct point-to-point courier network with zero sorting hubs, live driver telemetry, and tamper-proof chain of custody.",
    h1: "About Nokael Dedicated Transit",
    content: "Direct point-to-point corporate courier transit eliminating warehouse delays across the UAE.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "About", url: "/about" },
    ],
  },

  "/thank-you": {
    title: "Quote Request Received | Nokael Logistics",
    description: "Your delivery request has been received. Our dispatch controllers will assign the nearest available pilot shortly.",
    h1: "Request Confirmed",
    content: "Your mission request is logged in the Nokael dispatch queue.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Thank You", url: "/thank-you" },
    ],
  },

  "/dashboard": {
    title: "Nokael | Command Centre & Live Dispatch",
    description: "Real-time dispatch command centre for active missions, pilot assignment, and chain of custody management.",
    h1: "Command Centre",
    content: "Operational dashboard for managing active runs, quote requests, and driver fleet status.",
    breadcrumb: [{ name: "Dashboard", url: "/dashboard" }],
  },

  "/admin": {
    title: "Nokael | Command Centre & Live Dispatch",
    description: "Real-time dispatch command centre for active missions, pilot assignment, and chain of custody management.",
    h1: "Command Centre",
    content: "Operational dashboard for managing active runs, quote requests, and driver fleet status.",
    breadcrumb: [{ name: "Dashboard", url: "/admin" }],
  },

  "/login": {
    title: "Nokael | Dispatch Operations Login",
    description: "Secure login portal for Nokael dispatch controllers and fleet operators.",
    h1: "Operations Login",
    content: "Secure access to Nokael Command Centre.",
    breadcrumb: [{ name: "Login", url: "/login" }],
  },

  "/terms": {
    title: "Terms & Conditions | Nokael Logistics",
    description: "Terms and conditions of service for Nokael dedicated executive transit.",
    h1: "Terms & Conditions",
    content: "Service agreement and operational terms.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Terms", url: "/terms" },
    ],
  },

  "/privacy": {
    title: "Privacy Policy | Nokael Logistics",
    description: "Privacy policy and data protection terms for Nokael clients and partners.",
    h1: "Privacy Policy",
    content: "Information privacy and security standards.",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Privacy", url: "/privacy" },
    ],
  },

  "/404": {
    title: "Page Not Found | Nokael",
    description: "The page you are looking for does not exist. Return to Nokael's homepage for urgent UAE Dedicated Executive Transit services.",
    h1: "Page Not Found",
    content: "This page does not exist. Please use the navigation below to find what you need.",
    breadcrumb: [{ name: "Home", url: "/" }],
  },
};

export const DEFAULT_METADATA: PageMetadata = {
  title: "Nokael | Same-Day Courier Dubai to Abu Dhabi",
  description:
    "Urgent same-day business courier between Dubai and Abu Dhabi. Direct driver assignment, no sorting hubs, and fast corporate delivery.",
  h1: "Dedicated Executive Transit Dubai to Abu Dhabi",
  content:
    "Nokael provides fast and reliable urgent B2B delivery services across the UAE. We specialize in time-critical corporate logistics needs between major cities like Dubai and Abu Dhabi.",
  faqs: [],
  sla: "Fast dispatch",
};

export const KNOWN_APP_ROUTES = [
  "/get-quote",
  "/thank-you",
  "/track",
  "/business-account",
  "/apply-driver",
  "/terms",
  "/privacy",
  "/dashboard",
  "/login",
  "/accept-invite",
  "/onboarding",
  "/",
];

/** App routes with a dynamic tail (other companies' sites: /c/<slug>/…). */
export const APP_ROUTE_PREFIXES = ["/c/", "/track/"];
