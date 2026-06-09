/**
 * Subscribe app to WABA (fixes silent webhook failures).
 * Requires WHATSAPP_BUSINESS_ACCOUNT_ID in .env
 * Run: npm run setup:whatsapp
 */

require("dotenv").config();

const token = process.env.WHATSAPP_TOKEN?.trim();
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
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
  console.log("\n=== WhatsApp WABA Setup ===\n");

  if (!token || !phoneId) {
    console.error("Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    process.exit(1);
  }

  const phone = await api(
    `/${phoneId}?fields=display_phone_number,verified_name,status,account_mode`
  );
  console.log("Phone:", phone.display_phone_number, "| Status:", phone.status);
  console.log("Mode:", phone.account_mode);

  if (phone.status !== "CONNECTED") {
    console.log("\n⚠ Register phone first: npm run register:whatsapp -- YOUR_6_DIGIT_PIN");
  }

  if (!wabaId) {
    console.error("\n✗ WHATSAPP_BUSINESS_ACCOUNT_ID missing in .env\n");
    console.log("How to find it:");
    console.log("  1. developers.facebook.com → Your App → WhatsApp → API Setup");
    console.log("  2. Copy 'WhatsApp Business Account ID' (long number)");
    console.log("  3. Add to .env: WHATSAPP_BUSINESS_ACCOUNT_ID=your_id_here");
    console.log("  4. Run this script again\n");
    process.exit(1);
  }

  console.log("WABA ID:", wabaId);

  const phones = await api(`/${wabaId}/phone_numbers?fields=id,display_phone_number,status`);
  if (phones.data) {
    console.log("\nPhones on this WABA:");
    for (const p of phones.data) {
      const mark = p.id === phoneId ? " ← current" : "";
      console.log(`  ${p.display_phone_number} (${p.id}) ${p.status}${mark}`);
    }
  }

  const subsBefore = await api(`/${wabaId}/subscribed_apps`);
  if (subsBefore.error) {
    console.error("\n✗ Cannot access WABA:", subsBefore.error.message);
    console.error("  Check WHATSAPP_BUSINESS_ACCOUNT_ID and token permissions.");
    process.exit(1);
  }

  if (subsBefore.data?.length) {
    console.log("\n✓ App already subscribed to WABA");
  } else {
    console.log("\n→ Subscribing app to WABA (this enables incoming message webhooks)...");
    const result = await api(`/${wabaId}/subscribed_apps`, { method: "POST", body: "{}" });
    if (result.success) console.log("✓ Subscribed!");
    else console.error("✗ Failed:", result.error?.message);
  }

  const subsAfter = await api(`/${wabaId}/subscribed_apps`);
  console.log("\nSubscribed apps:", subsAfter.data?.length || 0);

  console.log("\nNext: npm run webhook:status");
  console.log("Then message +234 814 735 6020 — watch npm start terminal for 'Message from...'\n");
}

run().catch(console.error);
