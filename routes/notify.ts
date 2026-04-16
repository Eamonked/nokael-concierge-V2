import { Router } from "express";
import { requireApiKey, rateLimit } from "../middleware/security.js";

// Max message length to prevent abuse
const MAX_MESSAGE_LENGTH = 4096;

export function createNotifyRouter() {
  const router = Router();

  // Rate limit: 20 notifications per minute per IP
  router.post("/notify", rateLimit(20, 60_000), requireApiKey, async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required and must be a string" });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("[notify] Telegram env vars missing");
      return res.status(500).json({ error: "Notification service not configured" });
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[notify] Telegram API error:", errorData);
        return res.status(502).json({
          error: "Notification delivery failed",
          details: errorData.description ?? "Unknown error",
        });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("[notify] Fetch error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
