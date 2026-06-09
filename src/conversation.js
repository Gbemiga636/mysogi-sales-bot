const fs = require("fs");
const path = require("path");
const config = require("./config");

function getConversationPath(phone) {
  const safe = phone.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(process.cwd(), config.paths.conversations, `${safe}.json`);
}

function ensureDir() {
  const dir = path.join(process.cwd(), config.paths.conversations);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadHistory(phone) {
  ensureDir();
  const filePath = getConversationPath(phone);
  if (!fs.existsSync(filePath)) return [];

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

function saveHistory(phone, history) {
  ensureDir();
  const trimmed = history.slice(-config.conversation.maxHistoryMessages);
  fs.writeFileSync(getConversationPath(phone), JSON.stringify(trimmed, null, 2));
}

function addMessage(phone, role, content) {
  const history = loadHistory(phone);
  history.push({ role, content });
  saveHistory(phone, history);
  return history;
}

function clearHistory(phone) {
  ensureDir();
  const filePath = getConversationPath(phone);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { loadHistory, addMessage, clearHistory };
