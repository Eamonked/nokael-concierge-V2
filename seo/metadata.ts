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

export const SEO_METADATA: Record<string, PageMetadata> = {
  "/": {
    title: "Nokael | Urgent B2B Courier Dubai to Abu Dhabi",
    description:
      "Direct-response B2B courier service between Dubai and Abu Dhabi. Dedicated driver assignment for legal documents and corporate logistics. No warehouses, no delays.",
    h1: "Urgent B2B Courier: Dubai ↔ Abu Dhabi Dispatch",
    content: `Dedicated driver. No hubs. Immediate dispatch. We provide same-day courier services from Dubai to Abu Dhabi, including express document delivery, urgent parcel transport, and dedicated business logistics across the UAE.
      Nokael provides urgent same-day business courier services between Dubai and Abu Dhabi. We offer direct driver assignment, no warehouses, and no sorting hubs for your time-critical documents, parcels, and spare parts.
      Whether it is a legal tender, a sensitive contract, or an emergency spare part, our dedicated drivers ensure your items reach their destination safely and on time.`,
    price: "230",
    sla: "90-120 min delivery",
    zones: ["DIFC", "Downtown Dubai", "Jebel Ali", "Abu Dhabi Global Market", "Mussafah"],
    faqs: [
      {
        q: "How fast is the delivery between Dubai and Abu Dhabi?",
        a: "Typically, transit time is between 90 to 120 minutes depending on traffic and pickup location.",
      },
      {
        q: "Do you offer real-time tracking?",
        a: "Yes, we provide real-time updates via WhatsApp directly from the assigned driver.",
      },
    ],
    breadcrumb: [{ name: "Home", url: "/" }],
  },

  "/urgent-delivery-dubai": {
    title: "Urgent Courier Dubai | Nokael Business Delivery",
    description:
      "Urgent courier in Dubai with same-day dispatch and direct driver assignment for documents and parcels. Fast inter-emirate transport from Dubai to all emirates.",
    h1: "Urgent Courier Dubai Dispatch.",
    content: `Fast inter-emirate transport starting from Dubai. Pickup typically within 30–60 minutes for immediate dispatch to Abu Dhabi, Sharjah, and beyond. Built for businesses that cannot afford logistics delays.
      Nokael provides a direct-response dispatch system for companies and individuals in Dubai who need items moved to other emirates immediately.
      Our drivers are strategically positioned across Dubai—from Downtown and DIFC to Jebel Ali and Dubai Marina—to ensure rapid response times. We don't use sorting hubs; your item goes from the pickup point directly to the delivery destination.`,
    price: "230",
    sla: "30-60 min pickup",
    zones: ["DIFC", "Downtown", "Business Bay", "JLT", "Jebel Ali", "Dubai Marina"],
    faqs: [
      {
        q: "What areas in Dubai do you cover?",
        a: "We cover all major business hubs including DIFC, Downtown, Business Bay, JLT, and Jebel Ali.",
      },
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Urgent Delivery Dubai", url: "/urgent-delivery-dubai" },
    ],
  },

  "/urgent-delivery-abu-dhabi": {
    title: "Urgent Courier Abu Dhabi | Nokael Business Delivery",
    description:
      "Urgent courier in Abu Dhabi for same-day and inter-emirate delivery with fast response. Dedicated drivers for direct transport to Dubai.",
    h1: "Urgent Courier Abu Dhabi Dispatch.",
    content: `Premium inter-emirate logistics from the capital. Dedicated drivers for direct transport to Dubai and the Northern Emirates. Serving government, corporate, and private clients with precision.
      Abu Dhabi requires a higher level of logistics precision. Nokael serves the capital's most demanding delivery needs, providing dedicated transport for government, corporate, and private clients.
      Our Abu Dhabi dispatch network covers the entire city, including Al Reem Island, Khalifa City, and the Industrial areas. We specialize in the Abu Dhabi ↔ Dubai corridor, offering the fastest possible transit times between the two major hubs.`,
    price: "230",
    sla: "30-60 min pickup",
    zones: ["Al Reem Island", "Khalifa City", "Mussafah", "ADGM", "Corniche"],
    faqs: [
      {
        q: "Can you deliver from Abu Dhabi to the Northern Emirates?",
        a: "Yes, we provide direct delivery from Abu Dhabi to Sharjah, Ajman, RAK, and Fujairah.",
      },
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
      "Secure urgent document delivery for UAE legal tenders and corporate contracts. Hand-to-hand B2B courier with a dedicated driver and direct chain of custody.",
    h1: "Urgent Legal & Corporate Document Dispatch.",
    content: `Secure, hand-to-hand transport for sensitive legal documents, contracts, and government tenders across all emirates. Dedicated driver assignment with real-time tracking and immediate proof of delivery via WhatsApp.
      In the B2B logistics world, some documents are too critical for standard courier networks. Nokael provides a premium dispatch service that prioritizes security and direct accountability.
      Our drivers handle your sensitive materials with the utmost care, providing hand-to-hand delivery from the sender directly to the recipient. We understand the critical nature of legal deadlines and government tender submissions.`,
    price: "230",
    sla: "Hand-to-hand security",
    zones: ["All UAE Courts", "Free Zones", "Government Offices", "Embassies"],
    faqs: [
      {
        q: "Is the document delivery secure?",
        a: "Yes, we provide hand-to-hand delivery with a dedicated driver, ensuring a strict chain of custody.",
      },
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
      { name: "Document Delivery UAE", url: "/document-delivery-uae" },
    ],
  },

  "/spare-parts-delivery-uae": {
    title: "Urgent Spare Parts Delivery UAE | Nokael Courier",
    description:
      "Emergency spare parts delivery across the UAE for automotive and industrial needs. Direct from supplier to site with 24/7 dispatch.",
    h1: "Urgent Spare Parts Logistics.",
    content: `Emergency transport for critical machinery, automotive, and industrial parts. Direct from supplier to site. 24/7 emergency dispatch for industrial hardware across the UAE.
      When machinery breaks down or a vehicle is off the road, every minute costs money. Nokael provides emergency spare parts logistics for the industrial and automotive sectors across the UAE.
      We specialize in the rapid transport of critical components that are too urgent for traditional freight. Our drivers can pick up directly from suppliers or warehouses and deliver straight to the site where the part is needed.`,
    price: "380",
    sla: "Immediate site delivery",
    zones: ["Industrial Areas", "Construction Sites", "Workshops", "Ports"],
    faqs: [
      {
        q: "Do you handle heavy spare parts?",
        a: "We handle items that can fit in a standard vehicle. For larger items, please contact us for a custom quote.",
      },
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
    price: "230",
    sla: "Point-to-point delivery",
    zones: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "RAK", "Fujairah", "UAQ"],
    faqs: [
      {
        q: "What services do you offer?",
        a: "We offer Urgent Inter-Emirate delivery, Document & Legal transport, and Spare Parts logistics.",
      },
    ],
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Services", url: "/services" },
    ],
  },

  "/get-quote": {
    title: "Request Urgent Courier Quote | Nokael UAE Dispatch",
    description: "Get an immediate quote for time-critical document or parcel delivery between Dubai, Abu Dhabi, and all emirates. 5-minute driver assignment.",
    h1: "Request an Immediate Courier Quote.",
    content: "Our dispatch system provides instant routing and driver assignment for urgent logistics across the UAE. Fill out the route and item details for a dedicated courier dispatch.",
    price: "230",
    sla: "2-5 minute assignment",
    breadcrumb: [
      { name: "Home", url: "/" },
      { name: "Request Quote", url: "/get-quote" },
    ],
  },

  "/404": {
    title: "Page Not Found | Nokael",
    description: "The page you are looking for does not exist. Return to Nokael's homepage for urgent UAE courier services.",
    h1: "Page Not Found",
    content: "This page does not exist. Please use the navigation below to find what you need.",
    breadcrumb: [{ name: "Home", url: "/" }],
  },
};

export const DEFAULT_METADATA: PageMetadata = {
  title: "Nokael | Urgent UAE B2B Delivery",
  description:
    "Urgent B2B courier services across the UAE. Direct driver assignment, no hubs, and fast corporate delivery between Dubai and Abu Dhabi.",
  h1: "Urgent UAE B2B Delivery",
  content:
    "Nokael provides fast and reliable urgent B2B delivery services across the UAE. We specialize in time-critical corporate courier needs between major cities like Dubai and Abu Dhabi.",
  faqs: [],
  price: "230",
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
  "/",
];
