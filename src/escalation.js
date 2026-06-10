const fs = require("fs");
const path = require("path");
const config = require("./config");
const { sendTextMessage } = require("./whatsapp");

const QUEUE_FILE = () =>
  path.join(config.paths.conversations, "escalation-queue.json");
const REPLY_MAP_FILE = () =>
  path.join(config.paths.conversations, "odun-reply-map.json");

function ensureDir() {
  if (!fs.existsSync(config.paths.conversations)) {
    fs.mkdirSync(config.paths.conversations, { recursive: true });
  }
}

function normalizePhone(phone) {
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = `234${p.slice(1)}`;
  if (p.length === 10) p = `234${p}`;
  return p;
}

function isMrOdun(phone) {
  return normalizePhone(phone) === normalizePhone(config.manager.phone);
}

function formatRepPhone(phone) {
  const p = normalizePhone(phone);
  return `+${p}`;
}

// --- Rep escalation state (typing their issue) ---

const STATE_FILE = (phone) => {
  const safe = phone.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(config.paths.conversations, `${safe}.state.json`);
};

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
  return /^(mr\s*odun|talk\s+to\s+mr\s*odun|speak\s+to\s+mr\s*odun|need\s+mr\s*odun|reach\s+mr\s*odun|escalate|human|real\s+person|manager)$/i.test(
    text.trim()
  );
}

// --- Pending queue & reply-to-message mapping ---

function loadQueue() {
  ensureDir();
  const file = QUEUE_FILE();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE(), JSON.stringify(queue, null, 2));
}

function addToQueue(repPhone, message) {
  const queue = loadQueue();
  const entry = {
    repPhone: normalizePhone(repPhone),
    message,
    createdAt: Date.now(),
  };
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

function removeFromQueue(repPhone) {
  const p = normalizePhone(repPhone);
  saveQueue(loadQueue().filter((e) => e.repPhone !== p));
}

function loadReplyMap() {
  ensureDir();
  const file = REPLY_MAP_FILE();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveReplyMap(map) {
  ensureDir();
  fs.writeFileSync(REPLY_MAP_FILE(), JSON.stringify(map, null, 2));
}

function mapOdunMessageToRep(odunMessageId, repPhone, originalQuestion) {
  const map = loadReplyMap();
  map[odunMessageId] = {
    repPhone: normalizePhone(repPhone),
    originalQuestion,
    createdAt: Date.now(),
  };
  saveReplyMap(map);
}

function lookupRepByOdunReply(contextMessageId) {
  if (!contextMessageId) return null;
  const map = loadReplyMap();
  return map[contextMessageId] || null;
}

function clearReplyMapping(contextMessageId) {
  const map = loadReplyMap();
  delete map[contextMessageId];
  saveReplyMap(map);
}

async function notifyMrOdun(repPhone, message) {
  const odunPhone = config.manager.phone;
  if (!odunPhone) return null;

  const repDisplay = formatRepPhone(repPhone);

  const body = `🔔 *Sales team needs you*

From: ${repDisplay}

Their issue:
${message}

━━━━━━━━━━━━━━━
*Reply to this message* with your response and I'll send it straight back to them on WhatsApp.`;

  const result = await sendTextMessage(odunPhone, body);
  const odunMessageId = result?.messages?.[0]?.id;

  if (odunMessageId) {
    mapOdunMessageToRep(odunMessageId, repPhone, message);
  }

  addToQueue(repPhone, message);
  return odunMessageId;
}

async function forwardOdunReplyToRep(repPhone, odunReply, originalQuestion) {
  const rep = normalizePhone(repPhone);
  const body = `📩 *Message from Mr Odun*

${odunReply}

${originalQuestion ? `\n—\nRe your question:\n_"${originalQuestion}"_` : ""}`;

  await sendTextMessage(rep, body);
}

/**
 * Handle messages FROM Mr Odun to the Mysogi bot number.
 */
async function handleMrOdunMessage(text, contextMessageId) {
  const trimmed = text.trim();

  if (/^(list|pending)$/i.test(trimmed)) {
    const queue = loadQueue();
    if (queue.length === 0) {
      return { text: "No pending sales requests right now ✓" };
    }
    const lines = queue.map(
      (e, i) =>
        `${i + 1}. ${formatRepPhone(e.repPhone)}\n   "${e.message.slice(0, 80)}${e.message.length > 80 ? "..." : ""}"`
    );
    return {
      text: `Pending (${queue.length}):\n\n${lines.join("\n\n")}\n\nReply to the escalation message to respond to that person.`,
    };
  }

  // Best: Mr Odun replied TO the escalation message (exact person)
  const mapped = lookupRepByOdunReply(contextMessageId);
  if (mapped) {
    await forwardOdunReplyToRep(mapped.repPhone, trimmed, mapped.originalQuestion);
    clearReplyMapping(contextMessageId);
    removeFromQueue(mapped.repPhone);

    const remaining = loadQueue().length;
    let confirm = `✓ Sent to ${formatRepPhone(mapped.repPhone)}`;
    if (remaining > 0) {
      confirm += `\n\n${remaining} more request(s) waiting — reply to their escalation messages.`;
    }
    return { text: confirm };
  }

  // Fallback: send to oldest in queue
  const queue = loadQueue();
  if (queue.length === 0) {
    return {
      text: "No pending request linked to this message.\n\nWhen a rep escalates, you'll get their issue — *reply to that message* with your response.",
    };
  }

  const next = queue[0];
  await forwardOdunReplyToRep(next.repPhone, trimmed, next.message);
  removeFromQueue(next.repPhone);

  const remaining = loadQueue().length;
  let confirm = `✓ Sent to ${formatRepPhone(next.repPhone)}`;
  if (remaining > 0) {
    confirm += `\n\nNext waiting: ${formatRepPhone(queue[0].repPhone)} — reply to their escalation message.`;
  }
  return { text: confirm };
}

async function handleEscalationFlow(phone, text) {
  const state = getState(phone);
  const trimmed = text.trim();

  if (isEscalationRequest(trimmed)) {
    setState(phone, { mode: "awaiting_message" });
    return {
      type: "reply",
      text: `Say less — I'll pass this to Mr Odun 👍

Type your full question or issue in one message and he'll get it.

When he replies, you'll see his message right here on WhatsApp.`,
    };
  }

  if (state.mode === "awaiting_message") {
    if (trimmed.length < 5) {
      return {
        type: "reply",
        text: "Give me a bit more detail so Mr Odun knows exactly how to help 🙏",
      };
    }

    const odunMessageId = await notifyMrOdun(phone, trimmed);
    clearState(phone);

    if (odunMessageId) {
      return {
        type: "reply",
        text: `Done ✓ Mr Odun has your message.

He'll reply here on WhatsApp when he responds — you'll see it in this chat.

You can keep asking me other questions while you wait.`,
      };
    }

    return {
      type: "reply",
      text: `Couldn't reach Mr Odun automatically — message him directly: ${config.manager.displayPhone}`,
    };
  }

  return null;
}

module.exports = {
  isMrOdun,
  handleMrOdunMessage,
  handleEscalationFlow,
  getState,
  setState,
  clearState,
  isEscalationRequest,
};
