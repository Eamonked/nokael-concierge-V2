import express from "express";
import path from "path";
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
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
