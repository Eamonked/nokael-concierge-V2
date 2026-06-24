import { Router } from "express";
import { requireApiKey, rateLimit } from "../middleware/security.js";

// Max message length to prevent abuse
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Escapes HTML special characters for Telegram's HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

    const sanitizedMessage = escapeHtml(message);

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
        const errorData = await response.json() as any;
        console.error("[notify] Telegram API error:", errorData);
        
        if (response.status === 403 || errorData.error_code === 403) {
          const isBotToBot = errorData.description && errorData.description.includes("can't send messages to the bot");
          if (isBotToBot) {
            console.warn(
              `\n🚨 [TELEGRAM CONFIGURATION ERROR] 🚨\n` +
              `Your TELEGRAM_CHAT_ID environment variable is misconfigured!\n` +
              `It is currently set to the Bot's own ID or username. A Telegram Bot cannot send messages to itself.\n` +
              `To resolve this, you must change TELEGRAM_CHAT_ID in your Settings / Environment Variables:\n` +
              `1. It should be your PERSONAL Telegram Chat ID (a number like '123456789'), NOT the bot's ID/username.\n` +
              `2. To find your personal Chat ID, search for "@userinfobot" on Telegram, send any message, and copy the "Id" value.\n` +
              `3. Update your environment variables with this new ID and restart the app.\n`
            );
          } else {
            console.warn(
              `\n⚠️  [TELEGRAM API ERROR 403 RESOLUTION GUIDE] ⚠️\n` +
              `The Telegram API returned a 403 Forbidden error: "${errorData.description}".\n` +
              `This typically happens because of one of the following reasons:\n` +
              `1. The user (chat ID: "${chatId}") has blocked or stopped the bot. To resolve this, the recipient must search for the bot on Telegram and click "Start" (or send "/start" to it).\n` +
              `2. If sending to a Group or Channel, the bot has not been added as a member (or has been kicked out). To resolve, add the bot to the group/channel. For channels, the bot MUST also be promoted to an Administrator with posting permissions.\n` +
              `3. The TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN environment variables are misconfigured.\n` +
              `Please verify your environment credentials and Bot configuration to resolve this.\n`
            );
          }
        }

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
