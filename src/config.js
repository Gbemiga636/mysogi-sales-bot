require("dotenv").config();
const path = require("path");
const os = require("os");

const isVercel = Boolean(process.env.VERCEL);
const dataRoot = isVercel
  ? path.join(os.tmpdir(), "mysogi-bot")
  : process.cwd();

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  companyName: process.env.COMPANY_NAME || "Mysogi",
  managerName: "Mr Odun",
  manager: {
    phone: (process.env.MR_ODUN_PHONE || "2348087965610").replace(/\D/g, ""),
    displayPhone: process.env.MR_ODUN_DISPLAY || "+234 808 796 5610",
  },
  isVercel,
  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim(),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
    embeddingModel: "text-embedding-3-small",
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN?.trim(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim(),
    verifyToken: process.env.VERIFY_TOKEN?.trim(),
    apiVersion: "v21.0",
  },
  paths: {
    documents: path.join(process.cwd(), "data/documents"),
    chats: path.join(process.cwd(), "data/chats"),
    coreKnowledge: path.join(process.cwd(), "data/documents/MYSOGI-SALES-KNOWLEDGE-BASE.txt"),
    knowledgeIndex: path.join(process.cwd(), "data/knowledge-index.json"),
    embeddings: path.join(process.cwd(), "data/embeddings.json"),
    styleExamples: path.join(process.cwd(), "data/style-examples.json"),
    conversations: path.join(dataRoot, "data/conversations"),
  },
  conversation: {
    maxHistoryMessages: 20,
    maxContextChunks: 6,
  },
};

function validateConfig() {
  const missing = [];

  if (!config.openai.apiKey) missing.push("OPENAI_API_KEY");
  if (!config.whatsapp.token) missing.push("WHATSAPP_TOKEN");
  if (!config.whatsapp.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!config.whatsapp.verifyToken) missing.push("VERIFY_TOKEN");

  if (missing.length > 0) {
    console.warn(
      `Warning: missing env vars: ${missing.join(", ")}. Bot will not work until these are set.`
    );
  }
}

validateConfig();

module.exports = config;
