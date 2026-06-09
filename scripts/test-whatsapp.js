/**
 * Test WhatsApp Cloud API token + phone number.
 * Run: npm run test:whatsapp
 */

require("dotenv").config();

const token = process.env.WHATSAPP_TOKEN?.trim();
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const API = "https://graph.facebook.com/v21.0";

async function run() {
  console.log("\n=== WhatsApp API Test ===\n");

  if (!token) {
    console.error("✗ WHATSAPP_TOKEN missing in .env");
    process.exit(1);
  }
  if (!phoneId) {
    console.error("✗ WHATSAPP_PHONE_NUMBER_ID missing in .env");
    process.exit(1);
  }

  console.log("Phone Number ID:", phoneId);

  // 1. Validate token + phone number
  const phoneRes = await fetch(`${API}/${phoneId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const phoneData = await phoneRes.json();

  if (phoneData.error) {
    console.error("✗ Token / Phone ID failed:");
    console.error(`  Code ${phoneData.error.code}: ${phoneData.error.message}`);
    if (phoneData.error.code === 190) {
      console.error("\n  → Token expired or invalid. Generate a new permanent token in Meta Business Settings.");
    }
    process.exit(1);
  }

  console.log("✓ Token is valid");
  console.log("  Display number:", phoneData.display_phone_number || "(not set)");
  console.log("  Verified name:", phoneData.verified_name || "(not set)");
  console.log("  Quality rating:", phoneData.quality_rating || "n/a");

  const expected = "2348147356020";
  const actual = (phoneData.display_phone_number || "").replace(/\D/g, "");
  if (actual.includes(expected) || expected.includes(actual.slice(-10))) {
    console.log("✓ Matches your number +234 814 735 6020");
  } else if (actual) {
    console.log("⚠ Display number is:", phoneData.display_phone_number);
    console.log("  (Confirm this is the number you expect)");
  }

  // 2. Optional: send test message
  const testTo = process.argv[2]?.replace(/\D/g, "");
  if (testTo) {
    console.log(`\n→ Sending test message to ${testTo}...`);
    const sendRes = await fetch(`${API}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: testTo,
        type: "text",
        text: {
          body: "✅ Test from Mr Odun's assistant — your WhatsApp bot is connected and working! 🤝",
        },
      }),
    });
    const sendData = await sendRes.json();
    if (sendData.error) {
      console.error("✗ Send failed:", sendData.error.message);
      if (sendData.error.code === 131030) {
        console.error("  → Add this number as a test recipient in Meta Developer → WhatsApp → API Setup");
      }
      process.exit(1);
    }
    console.log("✓ Test message sent! Message ID:", sendData.messages?.[0]?.id);
    console.log("  Check WhatsApp on that phone.");
  } else {
    console.log("\nTo send a test message, run:");
    console.log("  npm run test:whatsapp -- 2349043614284");
    console.log("  (use your personal WhatsApp number, country code, no + or spaces)");
  }

  // 3. Local server check
  const port = process.env.PORT || 3000;
  try {
    const health = await fetch(`http://localhost:${port}/health`);
    const h = await health.json();
    console.log(`\n✓ Local bot server running on port ${port}:`, h.status);
  } catch {
    console.log(`\n⚠ Bot server not running on port ${port} — run: npm start`);
  }

  console.log("\n=== WhatsApp test complete ===\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
