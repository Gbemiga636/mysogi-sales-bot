const OpenAI = require("openai");
const config = require("./config");

let client = null;

function getOpenAI() {
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: 60000,
      maxRetries: 2,
    });
  }
  return client;
}

function classifyOpenAIError(err) {
  const code = err?.code || err?.error?.code;
  const status = err?.status;

  if (status === 401 || code === "invalid_api_key") {
    return "OpenAI API key is invalid. Check OPENAI_API_KEY in your .env file.";
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return "OpenAI rate limit hit — try again in a few seconds.";
  }
  if (status === 403 || code === "insufficient_quota") {
    return "OpenAI billing/quota issue — add credits at platform.openai.com.";
  }
  if (code === "model_not_found") {
    return `Model "${config.openai.model}" not available — try OPENAI_MODEL=gpt-4o-mini in .env.`;
  }
  return null;
}

async function verifyOpenAI() {
  const openai = getOpenAI();
  await openai.models.list();
  return true;
}

module.exports = { getOpenAI, classifyOpenAIError, verifyOpenAI };
