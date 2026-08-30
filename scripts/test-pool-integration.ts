/**
 * Exercises the /api/pool integration end-to-end against a running server,
 * using the real Nokael tenant API key from the environment. This is
 * intentionally a server-side script, not a browser action: the pool key
 * authenticates a tenant's *backend*, so it must never reach a bundle a
 * browser can inspect. Run against local dev (`npm run dev` in another
 * terminal) or against a deployed instance via APP_URL.
 *
 * Usage:
 *   npm run test:pool-integration
 *   APP_URL=https://www.nokael.com npm run test:pool-integration
 */
import "dotenv/config";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const POOL_KEY = process.env.SUPABASE_POOL_API_KEY_NOKAEL;

async function main() {
  if (!POOL_KEY) {
    console.error("SUPABASE_POOL_API_KEY_NOKAEL is not set in your environment. See .env.example.");
    process.exit(1);
  }

  console.log(`[test-pool-integration] Target: ${APP_URL}`);

  // 1. Create a job via the pool API — exercises create_job_for_org exactly
  //    as an external tenant's backend would call it.
  const jobRes = await fetch(`${APP_URL}/api/pool/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-nokael-pool-key": POOL_KEY,
    },
    body: JSON.stringify({
      sender_name: "Pool Integration Test",
      sender_phone: "+971500000000",
      recipient_name: "Pool Integration Test Recipient",
      recipient_phone: "+971500000001",
      pickup_emirate: "Dubai",
      pickup_location: "Test pickup — pool integration script",
      delivery_emirate: "Abu Dhabi",
      delivery_location: "Test delivery — pool integration script",
      item_type: "document",
      urgency: "scheduled",
      notes: `Created by scripts/test-pool-integration.ts at ${new Date().toISOString()}`,
    }),
  });

  const jobBody = await jobRes.json();
  console.log(`[test-pool-integration] POST /api/pool/jobs -> ${jobRes.status}`);
  console.log(JSON.stringify(jobBody, null, 2));

  if (!jobRes.ok) {
    console.error("[test-pool-integration] Job creation failed — stopping.");
    process.exit(1);
  }

  // 2. Ask the matching primitive for a free driver in the same emirate —
  //    exercises match_driver_for_org. Does not assign anyone.
  const matchRes = await fetch(`${APP_URL}/api/pool/drivers/match?emirate=Dubai`, {
    headers: { "x-nokael-pool-key": POOL_KEY },
  });
  const matchBody = await matchRes.json();
  console.log(`[test-pool-integration] GET /api/pool/drivers/match -> ${matchRes.status}`);
  console.log(JSON.stringify(matchBody, null, 2));

  console.log(
    "\n[test-pool-integration] Done. Check the Command Centre dashboard — " +
      `job ${jobBody.job_ref ?? "(see above)"} should now appear in Pending Dispatch. ` +
      "It was created through the same path a real external tenant's backend would use, " +
      "not by inserting into the jobs table directly."
  );
}

main().catch((err) => {
  console.error("[test-pool-integration] Unexpected error:", err);
  process.exit(1);
});
