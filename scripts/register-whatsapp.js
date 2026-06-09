/**
 * Register WhatsApp phone number with Cloud API (fixes error 133010).
 * Run once after adding a new number or permanent token.
 *
 * Usage: npm run register:whatsapp -- 123456
 *        (123456 = your 6-digit two-step verification PIN — pick and save it)
 */

require("dotenv").config();

const token = process.env.WHATSAPP_TOKEN?.trim();
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const pin = process.argv[2];
const API = "https://graph.facebook.com/v21.0";

async function run() {
  if (!token || !phoneId) {
    console.error("Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env");
    process.exit(1);
  }

  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error("\nUsage: npm run register:whatsapp -- 123456");
    console.error("       Pick a 6-digit PIN and save it — this is WhatsApp 2-step verification.\n");
    process.exit(1);
  }

  console.log("\n=== WhatsApp Phone Registration ===\n");
  console.log("Phone Number ID:", phoneId);

  const statusRes = await fetch(
    `${API}/${phoneId}?fields=display_phone_number,verified_name,status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const statusBefore = await statusRes.json();
  console.log("Current status:", statusBefore.status || statusBefore.error?.message);
  console.log("Number:", statusBefore.display_phone_number);

  if (statusBefore.status === "CONNECTED") {
    console.log("\n✓ Phone already registered (CONNECTED). No action needed.\n");
    return;
  }

  console.log("\n→ Registering with Cloud API...");

  const registerRes = await fetch(`${API}/${phoneId}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin,
    }),
  });

  const registerData = await registerRes.json();

  if (registerData.error) {
    console.error("\n✗ Registration failed:");
    console.error(`  ${registerData.error.message} (code ${registerData.error.code})`);
    if (registerData.error.error_user_msg) {
      console.error(`  ${registerData.error.error_user_msg}`);
    }
    process.exit(1);
  }

  console.log("✓ Registration response:", registerData);

  const afterRes = await fetch(
    `${API}/${phoneId}?fields=display_phone_number,status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const statusAfter = await afterRes.json();
  console.log("New status:", statusAfter.status);
  console.log("\n✓ Done! Restart npm start and test with: npm run test:whatsapp -- YOUR_PERSONAL_NUMBER\n");
  console.log("SAVE YOUR PIN:", pin, "(needed if Meta asks for 2-step verification)\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
