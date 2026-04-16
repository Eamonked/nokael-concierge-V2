import { PageMetadata } from "./metadata.js";

/**
 * Generates JSON-LD structured data for a given page.
 * Includes LocalBusiness, Service, OfferCatalog, BreadcrumbList, and FAQPage schemas.
 */
export function getStructuredData(canonicalUrl: string, metadata: PageMetadata, siteUrl: string): string {
  const schemas: object[] = [];

  // LocalBusiness schema
  schemas.push({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Nokael",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    image: `${siteUrl}/og-image.jpg`,
    telephone: process.env.VITE_PHONE_NUMBER || "+971544324600",
    priceRange: "AED 185 - AED 500",
    openingHours: "Monday-Sunday 00:00-23:59",
    geo: {
      "@type": "GeoCoordinates",
      latitude: "25.2048",
      longitude: "55.2708",
    },
    areaServed: [
      { "@type": "City", name: "Dubai" },
      { "@type": "City", name: "Abu Dhabi" },
    ],
    sameAs: [
      "https://www.linkedin.com/company/nokael",
      `https://wa.me/${process.env.VITE_WHATSAPP_NUMBER || "971544324600"}`,
    ],
    description: metadata.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Dubai",
      addressRegion: "Dubai",
      addressCountry: "AE",
    },
  });

  // Service + OfferCatalog schema
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Urgent Courier",
    provider: { "@type": "LocalBusiness", name: "Nokael" },
    areaServed: "UAE",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Courier Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: metadata.h1 },
          price: metadata.price ?? "185",
          priceCurrency: "AED",
        },
      ],
    },
  });

  // BreadcrumbList schema
  if (metadata.breadcrumb && metadata.breadcrumb.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: metadata.breadcrumb.map((crumb, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: crumb.name,
        item: `${siteUrl}${crumb.url === "/" ? "" : crumb.url}`,
      })),
    });
  }

  // FAQPage schema
  if (metadata.faqs && metadata.faqs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: metadata.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return JSON.stringify(schemas);
}

/**
 * Builds visible SEO content as an HTML string.
 * This is injected server-side so crawlers see fully-rendered content.
 */
export function buildSeoContent(metadata: PageMetadata): string {
  const breadcrumbHtml =
    metadata.breadcrumb && metadata.breadcrumb.length > 1
      ? `<nav aria-label="Breadcrumb" style="font-size:13px;color:#666;margin-bottom:16px;">
          ${metadata.breadcrumb.map((c, i) => `<a href="${c.url}" style="color:#666;">${c.name}</a>${i < metadata.breadcrumb!.length - 1 ? " › " : ""}`).join("")}
        </nav>`
      : "";

  const zonesHtml = metadata.zones
    ? `<section style="margin-bottom:40px;">
        <h2>Areas we serve</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${metadata.zones.map((z) => `<div style="padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;">${z}</div>`).join("")}
        </div>
      </section>`
    : "";

  const faqsHtml =
    metadata.faqs && metadata.faqs.length > 0
      ? `<section style="margin-bottom:40px;">
          <h2>Logistics & Delivery FAQ</h2>
          ${metadata.faqs.map((f) => `<div style="margin-bottom:20px;"><h3 style="font-size:18px;margin-bottom:5px;">${f.q}</h3><p style="margin-top:0;">${f.a}</p></div>`).join("")}
        </section>`
      : "";

  return `
    <article style="max-width:800px;margin:0 auto;padding:20px;font-family:sans-serif;line-height:1.6;color:#1a1a1a;">
      <header style="border-bottom:2px solid #00ff00;padding-bottom:20px;margin-bottom:30px;">
        ${breadcrumbHtml}
        <p style="text-transform:uppercase;font-weight:bold;color:#666;font-size:12px;letter-spacing:2px;">Urgent Business Logistics UAE</p>
        <h1 style="font-size:32px;margin:10px 0;">${metadata.h1}</h1>
        <p style="font-size:18px;font-weight:500;">Direct Driver Dispatch. No Delays. No Hubs.</p>
        <div style="margin-top:20px;">
          <a href="tel:${process.env.VITE_PHONE_NUMBER || "+971544324600"}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;margin-right:10px;display:inline-block;">Call: ${process.env.VITE_DISPLAY_PHONE || "+971 54 432 4600"}</a>
          <a href="https://wa.me/${process.env.VITE_WHATSAPP_NUMBER || "971544324600"}" style="background:#00ff00;color:#000;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">WhatsApp Dispatch</a>
        </div>
      </header>

      <section style="margin-bottom:40px;">
        <h2>${metadata.h1}</h2>
        <p>${metadata.content}</p>
      </section>

      <section style="background:#f9f9f9;padding:30px;border-radius:12px;margin-bottom:40px;border:1px solid #eee;">
        <h2 style="margin-top:0;">Pricing & Logistics SLA</h2>
        <ul style="list-style:none;padding:0;">
          <li style="margin-bottom:10px;"><strong>Starting Price:</strong> From AED ${metadata.price ?? "185"}</li>
          <li style="margin-bottom:10px;"><strong>Guaranteed SLA:</strong> ${metadata.sla ?? "Fast dispatch"}</li>
          <li style="margin-bottom:10px;"><strong>Insurance:</strong> Fully insured transit for all business items</li>
          <li style="margin-bottom:10px;"><strong>Availability:</strong> 24/7 Emergency Dispatch</li>
        </ul>
      </section>

      ${zonesHtml}
      ${faqsHtml}

      <section style="border-top:1px solid #eee;padding-top:30px;">
        <h2>Reliable UAE Business Courier</h2>
        <p>Nokael is a fully licensed UAE courier operator specializing in high-priority, time-critical logistics for legal, corporate, and industrial sectors across the emirates.</p>
      </section>

      <nav style="margin-top:50px;padding:20px;background:#eee;border-radius:8px;">
        <p style="font-weight:bold;margin-top:0;">Explore Our Services:</p>
        <ul style="display:flex;flex-wrap:wrap;gap:15px;list-style:none;padding:0;">
          <li><a href="/" style="color:#000;font-weight:bold;">Urgent Courier Dubai to Abu Dhabi</a></li>
          <li><a href="/services" style="color:#000;font-weight:bold;">All Services</a></li>
          <li><a href="/urgent-delivery-dubai" style="color:#000;font-weight:bold;">Same-Day Courier Dubai</a></li>
          <li><a href="/urgent-delivery-abu-dhabi" style="color:#000;font-weight:bold;">Same-Day Courier Abu Dhabi</a></li>
          <li><a href="/get-quote" style="color:#000;font-weight:bold;">Request Immediate Pickup</a></li>
        </ul>
      </nav>
    </article>
  `;
}

/**
 * Injects SEO metadata and visible content into the HTML template.
 * The SPA mounts *inside* the injected content, so crawlers and users see the same HTML.
 */
export function injectMetadata(
  html: string,
  urlPath: string,
  metadata: PageMetadata,
  siteUrl: string,
  isProduction: boolean,
  skipContent: boolean = false
): string {
  const canonical = `${siteUrl}${urlPath === "/" ? "" : urlPath}`;
  const structuredData = getStructuredData(canonical, metadata, siteUrl);
  const robots = isProduction ? "index,follow" : "noindex,follow";
  const seoContent = skipContent ? "" : buildSeoContent(metadata);

  return html
    .replace(/{{TITLE}}/g, metadata.title)
    .replace(/{{DESCRIPTION}}/g, metadata.description)
    .replace(/{{CANONICAL}}/g, canonical)
    .replace(/{{IMAGE}}/g, `${siteUrl}/og-image.jpg`)
    .replace(/{{STRUCTURED_DATA}}/g, structuredData)
    .replace(/{{ROBOTS}}/g, robots)
    // Inject SEO article BEFORE the React root — crawlers see both, React mounts into #root
    .replace(
      '<div id="root"></div>',
      `${seoContent ? `<div id="seo-content" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;">${seoContent}</div>` : ""}<div id="root"></div>`
    );
}
