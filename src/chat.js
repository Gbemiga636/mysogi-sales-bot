const config = require("./config");
const { buildSystemPrompt } = require("./persona");
const { getKnowledgeContext } = require("./knowledge");
const { loadHistory, addMessage, clearHistory } = require("./conversation");
const { getOpenAI, classifyOpenAIError } = require("./openai-client");
const { handleEscalationFlow, clearState } = require("./escalation");

const GREETING = `Hi! It's Mr Odun's assistant here 🤝

Ask me anything — rates, billboards, Meta ads, client objections, whatever you need.

Need Mr Odun himself? Type *mr odun* or tap the button below.`;

const MENU_HINT = `\n\n—\nNot what you need? Type *mr odun* to reach him directly.`;

function isSimpleGreeting(text) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup|hiya)[!.?\s]*$/i.test(
    text.trim()
  );
}

function isMenuRequest(text) {
  return /^(menu|help|options)$/i.test(text.trim());
}

function buildSearchQuery(userMessage, history) {
  const recentUser = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content);

  return [...recentUser, userMessage].join(" ").trim();
}

async function generateReply(phone, userMessage, options = {}) {
  const trimmed = userMessage.trim();
  const { skipButtons = false } = options;

  if (/^(reset|clear|start over|new chat)$/i.test(trimmed)) {
    clearHistory(phone);
    clearState(phone);
    return {
      text: `Bet — fresh start, we move 🔄\n\n${GREETING}`,
      showButtons: true,
    };
  }

  if (isMenuRequest(trimmed)) {
    return {
      text: `Here's what I can do:

• Ask any sales question (rates, products, pitches)
• Type *mr odun* — I'll send your message straight to him
• Type *reset* — start a new chat

Mr Odun direct: ${config.manager.displayPhone}`,
      showButtons: true,
    };
  }

  // Button: Talk to Mr Odun
  if (trimmed === "mr_odun") {
    const result = await handleEscalationFlow(phone, "mr odun");
    return { text: result.text, showButtons: false };
  }

  // Button: Got it thanks — friendly close
  if (trimmed === "ask_ai") {
    return {
      text: "Cool — ask me anything else whenever you need 🤝",
      showButtons: false,
    };
  }

  // Escalation flow
  const escalation = await handleEscalationFlow(phone, trimmed);
  if (escalation) {
    return { text: escalation.text, showButtons: false };
  }

  const history = loadHistory(phone);

  if (isSimpleGreeting(trimmed) && history.length === 0) {
    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", GREETING);
    return { text: GREETING, showButtons: true };
  }

  try {
    const searchQuery = buildSearchQuery(trimmed, history);
    const skipRag = isSimpleGreeting(trimmed);
    const knowledgeContext = skipRag
      ? getKnowledgeContext("mysogi products rates channels")
      : getKnowledgeContext(searchQuery);

    const systemPrompt = `${buildSystemPrompt()}\n\n${knowledgeContext}`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: trimmed },
    ];

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      temperature: 0.35,
      top_p: 0.9,
      max_tokens: 1000,
      presence_penalty: 0.1,
      frequency_penalty: 0.05,
    });

    let reply =
      completion.choices[0]?.message?.content?.trim() ||
      "ngl something went wrong on my end — try again or type *mr odun* to reach him directly.";

    // Append escalation hint on substantive answers (not every time)
    if (!skipButtons && reply.length > 80 && !reply.includes("mr odun")) {
      reply += MENU_HINT;
    }

    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", reply);

    return { text: reply, showButtons: !skipButtons };
  } catch (err) {
    console.error("OpenAI error:", err.message);

    const known = classifyOpenAIError(err);
    const fallback = known
      ? `ngl I'm having a tech issue rn 😅 (${known})\n\nTry again in a sec or type *mr odun* to reach him directly.`
      : `ngl technical moment rn 😅 Try again or type *mr odun* for Mr Odun directly.`;

    return { text: fallback, showButtons: true };
  }
}

module.exports = { generateReply, buildSearchQuery, GREETING };
