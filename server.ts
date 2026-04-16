import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import multer from "multer";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Google Drive Auth
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"]
  });

  const drive = google.drive({ version: "v3", auth });

  const SITE_URL = process.env.SITE_URL || 'https://www.nokael.com';
  const IS_PRODUCTION = SITE_URL === 'https://www.nokael.com';

  const SEO_METADATA: Record<string, { title: string; description: string; h1: string; content: string; faqs?: { q: string; a: string }[] }> = {
    '/': {
      title: 'Nokael | Urgent Business Courier Dubai to Abu Dhabi',
      description: 'Urgent same-day business courier between Dubai and Abu Dhabi with direct driver assignment and fast delivery. Reliable inter-emirate logistics for time-critical items.',
      h1: 'Dedicated Business Courier for Fast Inter-Emirate Deliveries',
      content: `Nokael provides urgent same-day business courier services between Dubai and Abu Dhabi. We offer direct driver assignment, no warehouses, and no sorting hubs for your time-critical documents, parcels, and spare parts. 
      Our network is built for businesses that cannot afford logistics delays. We specialize in the Dubai-Abu Dhabi corridor, providing point-to-point delivery with immediate driver dispatch. 
      Whether it is a legal tender, a sensitive contract, or an emergency spare part, our dedicated drivers ensure your items reach their destination safely and on time.`,
      faqs: [
        { q: 'How fast is the delivery between Dubai and Abu Dhabi?', a: 'Typically, transit time is between 90 to 120 minutes depending on traffic and pickup location.' },
        { q: 'Do you offer real-time tracking?', a: 'Yes, we provide real-time updates via WhatsApp directly from the assigned driver.' }
      ]
    },
    '/urgent-delivery-dubai': {
      title: 'Urgent Courier Dubai | Nokael Business Delivery',
      description: 'Urgent courier in Dubai with same-day dispatch and direct driver assignment for documents and parcels. Fast inter-emirate transport from Dubai to all emirates.',
      h1: 'Urgent Courier Dubai Dispatch.',
      content: `Fast inter-emirate transport starting from Dubai. Pickup typically within 30–60 minutes for immediate dispatch to Abu Dhabi, Sharjah, and beyond. Built for businesses that cannot afford logistics delays.
      Nokael provides a direct-response dispatch system for companies and individuals in Dubai who need items moved to other emirates immediately. 
      Our drivers are strategically positioned across Dubai—from Downtown and DIFC to Jebel Ali and Dubai Marina—to ensure rapid response times. We don't use sorting hubs; your item goes from the pickup point directly to the delivery destination.`,
      faqs: [
        { q: 'What areas in Dubai do you cover?', a: 'We cover all major business hubs including DIFC, Downtown, Business Bay, JLT, and Jebel Ali.' }
      ]
    },
    '/urgent-delivery-abu-dhabi': {
      title: 'Urgent Courier Abu Dhabi | Nokael Business Delivery',
      description: 'Urgent courier in Abu Dhabi for same-day and inter-emirate delivery with fast response. Dedicated drivers for direct transport to Dubai.',
      h1: 'Urgent Courier Abu Dhabi Dispatch.',
      content: `Premium inter-emirate logistics from the capital. Dedicated drivers for direct transport to Dubai and the Northern Emirates. Serving government, corporate, and private clients with precision.
      Abu Dhabi requires a higher level of logistics precision. Nokael serves the capital's most demanding delivery needs, providing dedicated transport for government, corporate, and private clients.
      Our Abu Dhabi dispatch network covers the entire city, including Al Reem Island, Khalifa City, and the Industrial areas. We specialize in the Abu Dhabi ↔ Dubai corridor, offering the fastest possible transit times between the two major hubs.`,
      faqs: [
        { q: 'Can you deliver from Abu Dhabi to the Northern Emirates?', a: 'Yes, we provide direct delivery from Abu Dhabi to Sharjah, Ajman, RAK, and Fujairah.' }
      ]
    },
    '/document-delivery-uae': {
      title: 'Urgent Document Delivery UAE | Nokael Courier',
      description: 'Secure urgent document delivery across the UAE for contracts and sensitive business paperwork. Hand-to-hand delivery with chain of custody.',
      h1: 'Urgent Document & Legal Delivery.',
      content: `Secure, hand-to-hand transport for sensitive documents, contracts, and legal tenders across all emirates. Real-time tracking and immediate proof of delivery via WhatsApp.
      In the legal and corporate world, some documents are too important for standard courier services. Nokael provides a premium document dispatch service that prioritizes security and chain of custody.
      Our drivers handle your sensitive materials with the utmost care, providing hand-to-hand delivery from the sender directly to the recipient. We understand the critical nature of legal deadlines and government tender submissions.`,
      faqs: [
        { q: 'Is the document delivery secure?', a: 'Yes, we provide hand-to-hand delivery with a dedicated driver, ensuring a strict chain of custody.' }
      ]
    },
    '/spare-parts-delivery-uae': {
      title: 'Urgent Spare Parts Delivery UAE | Nokael Courier',
      description: 'Emergency spare parts delivery across the UAE for automotive and industrial needs. Direct from supplier to site with 24/7 dispatch.',
      h1: 'Urgent Spare Parts Logistics.',
      content: `Emergency transport for critical machinery, automotive, and industrial parts. Direct from supplier to site. 24/7 emergency dispatch for industrial hardware across the UAE.
      When machinery breaks down or a vehicle is off the road, every minute costs money. Nokael provides emergency spare parts logistics for the industrial and automotive sectors across the UAE.
      We specialize in the rapid transport of critical components that are too urgent for traditional freight. Our drivers can pick up directly from suppliers or warehouses and deliver straight to the site where the part is needed.`,
      faqs: [
        { q: 'Do you handle heavy spare parts?', a: 'We handle items that can fit in a standard vehicle. For larger items, please contact us for a custom quote.' }
      ]
    },
    '/services': {
      title: 'Direct Response Logistics Services | Nokael UAE',
      description: 'Specialized urgent delivery services across the UAE including documents, spare parts, and inter-emirate corridors. Built for speed and security.',
      h1: 'Direct Response Logistics Services.',
      content: `We provide specialized, high-speed transport solutions across the UAE. Built for speed, security, and direct accountability. Our services include urgent inter-emirate delivery, document & legal transport, and spare parts logistics.
      Traditional courier services rely on sorting hubs and shared vehicle loads. We bypass the traditional warehouse model entirely. One driver, one item, one direct route. We eliminate the friction of traditional logistics.`,
      faqs: [
        { q: 'What services do you offer?', a: 'We offer Urgent Inter-Emirate delivery, Document & Legal transport, and Spare Parts logistics.' }
      ]
    }
  };

  const DEFAULT_METADATA: { title: string; description: string; h1: string; content: string; faqs?: { q: string; a: string }[] } = {
    title: 'Nokael | Urgent UAE Delivery',
    description: 'Urgent business courier services across the UAE. Direct driver assignment and fast inter-emirate delivery.',
    h1: 'Urgent UAE Delivery',
    content: 'Nokael provides fast and reliable urgent delivery services across the UAE. We specialize in same-day business courier needs between major cities like Dubai and Abu Dhabi.',
    faqs: []
  };

  const getStructuredData = (url: string, metadata: any) => {
    const baseSchema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Nokael",
      "url": url,
      "logo": `${SITE_URL}/logo.png`,
      "image": `${SITE_URL}/og-image.jpg`,
      "telephone": "+971544324600",
      "areaServed": {
        "@type": "Country",
        "name": "UAE"
      },
      "description": metadata.description,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Dubai",
        "addressCountry": "AE"
      }
    };

    if (metadata.faqs) {
      return JSON.stringify([
        baseSchema,
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": metadata.faqs.map((f: any) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": f.a
            }
          }))
        }
      ]);
    }

    return JSON.stringify(baseSchema);
  };

  const injectMetadata = (html: string, urlPath: string) => {
    const metadata = SEO_METADATA[urlPath] || DEFAULT_METADATA;
    const canonical = `${SITE_URL}${urlPath === '/' ? '' : urlPath}`;
    const structuredData = getStructuredData(canonical, metadata);
    const robots = IS_PRODUCTION ? 'index,follow' : 'noindex,follow';
    
    // Build visible SEO content
    const visibleContent = `
      <article style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; line-height: 1.6;">
        <h1>${metadata.h1}</h1>
        <p>${metadata.content}</p>
        ${metadata.faqs ? `
          <section>
            <h2>Frequently Asked Questions</h2>
            ${metadata.faqs.map(f => `
              <div>
                <h3>${f.q}</h3>
                <p>${f.a}</p>
              </div>
            `).join('')}
          </section>
        ` : ''}
        <nav>
          <p>Quick Links:</p>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/services">Services</a></li>
            <li><a href="/urgent-delivery-dubai">Dubai Courier</a></li>
            <li><a href="/urgent-delivery-abu-dhabi">Abu Dhabi Courier</a></li>
            <li><a href="/get-quote">Get a Quote</a></li>
          </ul>
        </nav>
      </article>
    `;

    return html
      .replace(/{{TITLE}}/g, metadata.title)
      .replace(/{{DESCRIPTION}}/g, metadata.description)
      .replace(/{{CANONICAL}}/g, canonical)
      .replace(/{{IMAGE}}/g, `${SITE_URL}/og-image.jpg`)
      .replace(/{{STRUCTURED_DATA}}/g, structuredData)
      .replace(/name="robots" content="index,follow"/g, `name="robots" content="${robots}"`)
      .replace('<div id="root"></div>', `<div id="root">${visibleContent}</div>`);
  };

  // API Routes
  app.post("/api/upload-driver-doc", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return res.status(500).json({ error: "Google Drive folder ID missing" });
    }

    try {
      const fileMetadata = {
        name: `${Date.now()}-${req.file.originalname}`,
        parents: [folderId],
      };

      const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer),
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink",
      });

      const fileId = file.data.id;

      // Set permissions to "anyone with link can view"
      await drive.permissions.create({
        fileId: fileId!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      res.json({
        drive_file_id: fileId,
        file_url: file.data.webViewLink,
      });
    } catch (error) {
      console.error("Google Drive upload error:", error);
      res.status(500).json({ error: "Failed to upload to Google Drive" });
    }
  });

  app.post("/api/notify", async (req, res) => {
    const { message } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("Telegram configuration missing");
      return res.status(500).json({ error: "Telegram configuration missing" });
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Telegram API error:", errorData);
        return res.status(500).json({ 
          error: "Failed to send Telegram notification", 
          details: errorData.description || "Unknown Telegram error" 
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending Telegram notification:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const html = injectMetadata(template, url);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    
    app.get("*", (req, res) => {
      const url = req.originalUrl;
      const indexPath = path.join(distPath, "index.html");
      
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send("Build not found");
      }

      let html = fs.readFileSync(indexPath, "utf-8");
      html = injectMetadata(html, url);
      
      // Check if it's a known route or 404
      const isKnownRoute = SEO_METADATA[url] || ['/get-quote', '/thank-you', '/track', '/business-account', '/apply-driver', '/terms', '/privacy', '/dashboard', '/login'].includes(url);
      
      res.status(isKnownRoute ? 200 : 404).send(html);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
