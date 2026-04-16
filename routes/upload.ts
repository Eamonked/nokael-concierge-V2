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

  // Auth via JWT service account
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    // Handle both literal \n and real newlines in the private key
    key: (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? "").includes("\\n")
      ? process.env.GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, "\n")
      : process.env.GOOGLE_DRIVE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });

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

      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      if (!folderId) {
        console.error("[upload] GOOGLE_DRIVE_FOLDER_ID is not set");
        return res.status(500).json({ error: "Storage not configured" });
      }

      try {
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${Date.now()}-${safeName}`;

        const file = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [folderId],
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
