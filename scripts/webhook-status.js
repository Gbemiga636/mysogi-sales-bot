/**
 * Compare Meta webhook URL vs your current tunnel.
 * Run: npm run webhook:status
 */

require("dotenv").config();

const token = process.env.WHATSAPP_TOKEN?.trim();
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
const verifyToken = process.env.VERIFY_TOKEN?.trim();
const API = "https://graph.facebook.com/v21.0";

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return res.json();
}

async function run() {
  console.log("\n=== Webhook Status ===\n");

  const phone = await api(
    `/${phoneId}?fields=display_phone_number,status,account_mode,webhook_configuration,messaging_limit_tier`
  );

  if (phone.error) {
    console.error("Token error:", phone.error.message);
    process.exit(1);
  }

  const metaUrl = phone.webhook_configuration?.application || "(not set)";

  console.log("Phone:", phone.display_phone_number);
  console.log("Status:", phone.status);
  console.log("Mode:", phone.account_mode, phone.account_mode === "LIVE" ? "✓ (everyone can message)" : "⚠ Development only");
  console.log("Messaging tier:", phone.messaging_limit_tier);
  console.log("\nMeta webhook URL:", metaUrl);
  console.log("Your verify token:", verifyToken);

  if (wabaId) {
    const subs = await api(`/${wabaId}/subscribed_apps`);
    if (subs.error) {
      console.log("\nWABA subscription: could not check —", subs.error.message);
    } else {
      console.log("\nWABA subscribed apps:", subs.data?.length ? "YES ✓" : "NO ✗ — run npm run setup:whatsapp");
      for (const app of subs.data || []) {
        const info = app.whatsapp_business_api_data || app;
        console.log(`  - ${info.name} (${info.id})`);
      }
    }
  } else {
    console.log("\n⚠ Add WHATSAPP_BUSINESS_ACCOUNT_ID to .env (from Meta → WhatsApp → API Setup)");
  }

  console.log("\n--- Action items ---");
  if (metaUrl.includes("trycloudflare.com")) {
    console.log("⚠ Using temporary tunnel — URL changes every restart!");
    console.log("  1. Run: npm run tunnel");
    console.log("  2. Copy NEW url → Meta → WhatsApp → Configuration → Webhook");
    console.log("  3. Or deploy to Render for permanent URL (recommended)");
  }
  console.log("• Meta → WhatsApp → Configuration → Webhook → Manage → subscribe: messages");
  console.log("• Keep npm start running");
  console.log("• Add WABA ID to .env then run: npm run setup:whatsapp\n");
}

run().catch(console.error);
