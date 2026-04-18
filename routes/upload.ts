import { Router } from "express";
import multer from "multer";
import { google } from "googleapis";
import { Readable } from "stream";
import { requireApiKey, rateLimit } from "../middleware/security.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF"));
    }
  },
});

export function createUploadRouter() {
  const router = Router();

  // Rate limit: 10 uploads per minute per IP
  router.post(
    "/upload-driver-doc",
    rateLimit(10, 60_000),
    requireApiKey,
    upload.single("file"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const uploadFolderId = process.env.GOOGLE_DRIVE_UPLOAD_FOLDER_ID;
      const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
      const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

      const missing = [];
      if (!uploadFolderId) missing.push("GOOGLE_DRIVE_UPLOAD_FOLDER_ID");
      if (!clientId) missing.push("GOOGLE_DRIVE_CLIENT_ID");
      if (!clientSecret) missing.push("GOOGLE_DRIVE_CLIENT_SECRET");
      if (!refreshToken) missing.push("GOOGLE_DRIVE_REFRESH_TOKEN");

      if (missing.length > 0) {
        console.error(`[upload] Missing required environment variables: ${missing.join(", ")}`);
        return res.status(500).json({ 
          error: "Storage not configured", 
          details: "Missing environment variables on server." 
        });
      }

      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth });

      try {
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${Date.now()}-${safeName}`;

        const file = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [uploadFolderId],
          },
          media: {
            mimeType: req.file.mimetype,
            body: Readable.from(req.file.buffer),
          },
          fields: "id, webViewLink",
        });

        await drive.permissions.create({
          fileId: file.data.id!,
          requestBody: { role: "reader", type: "anyone" },
        });

        return res.json({
          drive_file_id: file.data.id,
          file_url: file.data.webViewLink,
        });
      } catch (err) {
        console.error("[upload] Google Drive error:", err);
        return res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  return router;
}
