const config = require("./config");
const { buildSystemPrompt } = require("./persona");
const { getKnowledgeContext } = require("./knowledge");
const { loadHistory, addMessage, clearHistory } = require("./conversation");
const { getOpenAI, classifyOpenAIError } = require("./openai-client");
const { handleEscalationFlow, clearState } = require("./escalation");

const GREETING = `Hi! It's Mr Odun's assistant here 🤝

Ask me anything — rates, billboards, Meta ads, client objections, whatever you need.

Whenever you're not getting the response you want, send *mr odun* — he'll reply right here in this chat.`;

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

async function generateReply(phone, userMessage) {
  const trimmed = userMessage.trim();

  if (/^(reset|clear|start over|new chat)$/i.test(trimmed)) {
    clearHistory(phone);
    clearState(phone);
    return {
      text: `Bet — fresh start, we move 🔄\n\n${GREETING}`,
    };
  }

  if (isMenuRequest(trimmed)) {
    return {
      text: `Here's what I can do:

• Ask any sales question (rates, products, pitches)
• Type *mr odun* — I'll send your message straight to him
• Type *reset* — start a new chat

Mr Odun direct: ${config.manager.displayPhone}`,
    };
  }

  // Button: Talk to Mr Odun
  if (trimmed === "mr_odun") {
    const result = await handleEscalationFlow(phone, "mr odun");
    return { text: result.text };
  }

  // Escalation flow
  const escalation = await handleEscalationFlow(phone, trimmed);
  if (escalation) {
    return { text: escalation.text };
  }

  const history = loadHistory(phone);

  if (isSimpleGreeting(trimmed) && history.length === 0) {
    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", GREETING);
    return { text: GREETING };
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

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "ngl something went wrong on my end — try again in a sec.";

    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", reply);

    return { text: reply };
  } catch (err) {
    console.error("OpenAI error:", err.message);

    const known = classifyOpenAIError(err);
    const fallback = known
      ? `ngl I'm having a tech issue rn 😅 (${known}) — try again shortly.`
      : `ngl technical moment rn 😅 Try again in a bit.`;

    return { text: fallback };
  }
}

module.exports = { generateReply, buildSearchQuery, GREETING };
