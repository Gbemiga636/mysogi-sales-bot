/**
 * Quick local tests before connecting Meta webhook.
 * Run: node scripts/test-local.js
 */

require("dotenv").config();

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

async function run() {
  console.log("\n=== Mr Odun Bot — Local Test ===\n");

  // 1. Health check
  try {
    const health = await fetch(`${BASE}/health`);
    const data = await health.json();
    console.log("✓ Health check:", data);
  } catch {
    console.error("✗ Server not running. Start it first: npm start");
    process.exit(1);
  }

  // 2. Webhook verification (same as Meta does)
  const challenge = "test_challenge_12345";
  const webhookUrl = `${BASE}/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN || "")}&hub.challenge=${challenge}`;

  const verifyRes = await fetch(webhookUrl);
  const verifyBody = await verifyRes.text();

  if (verifyRes.status === 200 && verifyBody === challenge) {
    console.log("✓ Webhook verification works");
    console.log(`  Verify token: ${VERIFY_TOKEN}`);
  } else {
    console.error("✗ Webhook verification failed");
    console.error(`  Status: ${verifyRes.status}, Body: ${verifyBody}`);
    console.error("  Check VERIFY_TOKEN in your .env file");
    process.exit(1);
  }

  // 3. OpenAI test (optional)
  if (process.env.OPENAI_API_KEY) {
    console.log("\n→ Testing OpenAI reply...");
    const { generateReply } = require("../src/chat");
    const result = await generateReply("test_user_local", "Hi");
    console.log("✓ OpenAI reply sample:\n");
    console.log(result.text);
    console.log("");
  }

  console.log("=== All local tests passed ===\n");
  console.log("Next: run cloudflared in another terminal:");
  console.log("  cloudflared tunnel --url http://localhost:3000");
  console.log("\nThen put this in Meta Developer → WhatsApp → Webhook:");
  console.log("  Callback URL: https://YOUR-TUNNEL-URL.trycloudflare.com/webhook");
  console.log(`  Verify token: ${VERIFY_TOKEN}`);
  console.log("");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
