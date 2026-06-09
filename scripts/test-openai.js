/**
 * Test OpenAI integration end-to-end.
 * Run: npm run test:openai
 */

require("dotenv").config();
const { verifyOpenAI } = require("../src/openai-client");
const { generateReply } = require("../src/chat");
const config = require("../src/config");

const TEST_QUESTIONS = [
  "Hi",
  "A client says our price is too high. What should I tell them?",
  "What's the best way to follow up after a demo?",
];

async function run() {
  console.log("\n=== OpenAI Integration Test ===\n");
  console.log(`Model: ${config.openai.model}`);

  if (!config.openai.apiKey) {
    console.error("✗ OPENAI_API_KEY missing in .env");
    process.exit(1);
  }

  try {
    await verifyOpenAI();
    console.log("✓ API key valid\n");
  } catch (err) {
    console.error("✗ API key failed:", err.message);
    process.exit(1);
  }

  for (const question of TEST_QUESTIONS) {
    console.log(`User: ${question}`);
    const reply = await generateReply("openai_test_user", question);
    console.log(`Bot:  ${reply}\n`);
    console.log("---\n");
  }

  console.log("=== OpenAI test complete ===\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
