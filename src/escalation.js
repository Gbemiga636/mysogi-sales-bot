const fs = require("fs");
const path = require("path");
const config = require("./config");
const { sendTextMessage } = require("./whatsapp");

const STATE_FILE = (phone) => {
  const safe = phone.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(config.paths.conversations, `${safe}.state.json`);
};

function ensureDir() {
  if (!fs.existsSync(config.paths.conversations)) {
    fs.mkdirSync(config.paths.conversations, { recursive: true });
  }
}

function getState(phone) {
  ensureDir();
  const file = STATE_FILE(phone);
  if (!fs.existsSync(file)) return { mode: "normal" };
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { mode: "normal" };
  }
}

function setState(phone, state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE(phone), JSON.stringify(state, null, 2));
}

function clearState(phone) {
  ensureDir();
  const file = STATE_FILE(phone);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function isEscalationRequest(text) {
  return /^(mr\s*odun|talk\s+to\s+mr\s*odun|speak\s+to\s+mr\s*odun|need\s+mr\s*odun|reach\s+mr\s*odun|escalate|human|real\s+person|manager|2)$/i.test(
    text.trim()
  );
}

function formatRepPhone(phone) {
  if (phone.startsWith("234")) return `+${phone}`;
  return phone;
}

async function notifyMrOdun(repPhone, message, context = "") {
  const odunPhone = config.manager.phone;
  if (!odunPhone) {
    console.warn("MR_ODUN_PHONE not set — cannot escalate");
    return false;
  }

  const repDisplay = formatRepPhone(repPhone);
  const body = `🔔 *Sales team escalation*

From: ${repDisplay}

Message:
${message}${context ? `\n\nRecent context:\n${context}` : ""}

— Reply to them on WhatsApp: ${repDisplay}`;

  await sendTextMessage(odunPhone, body);
  return true;
}

async function handleEscalationFlow(phone, text) {
  const state = getState(phone);
  const trimmed = text.trim();

  if (isEscalationRequest(trimmed) || trimmed.toLowerCase() === "mr_odun") {
    setState(phone, { mode: "awaiting_message" });
    return {
      type: "reply",
      text: `Say less — I'll pass this straight to Mr Odun 👍

Type your full question or issue in one message (rates, client situation, approval, whatever it is) and he'll get it on his end.

You can also reach him directly: ${config.manager.displayPhone}`,
    };
  }

  if (state.mode === "awaiting_message") {
    if (trimmed.length < 5) {
      return {
        type: "reply",
        text: "Give me a bit more detail so Mr Odun knows exactly how to help you 🙏",
      };
    }

    const { loadHistory } = require("./conversation");
    const history = loadHistory(phone);
    const recentContext = history
      .slice(-4)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const sent = await notifyMrOdun(phone, trimmed, recentContext);
    clearState(phone);

    if (sent) {
      return {
        type: "reply",
        text: `Done ✓ Your message is with Mr Odun now. He'll get back to you soon.

His line: ${config.manager.displayPhone}

Want to keep chatting with me? Just ask another question.`,
      };
    }

    return {
      type: "reply",
      text: `Couldn't send automatically rn — please message Mr Odun directly:

${config.manager.displayPhone}

Tell him you're from the sales team.`,
    };
  }

  return null;
}

module.exports = {
  getState,
  setState,
  clearState,
  isEscalationRequest,
  handleEscalationFlow,
  notifyMrOdun,
};
