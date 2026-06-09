const config = require("./config");
const { buildSystemPrompt } = require("./persona");
const { searchKnowledge, formatKnowledgeContext } = require("./knowledge");
const { loadHistory, addMessage } = require("./conversation");
const { getOpenAI, classifyOpenAIError } = require("./openai-client");

const GREETING =
  "Hi! It's Mr Odun's assistant here 🤝 What do you need help with today?";

function isSimpleGreeting(text) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup|hiya)[!.?\s]*$/i.test(
    text.trim()
  );
}

function buildSearchQuery(userMessage, history) {
  const recentUser = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content);

  return [...recentUser, userMessage].join(" ").trim();
}

async function safeSearchKnowledge(query) {
  try {
    return await searchKnowledge(query);
  } catch (err) {
    console.error("Knowledge search failed (continuing without docs):", err.message);
    return [];
  }
}

async function generateReply(phone, userMessage) {
  const trimmed = userMessage.trim();
  const isReset = /^(reset|clear|start over|new chat)$/i.test(trimmed);

  if (isReset) {
    const { clearHistory } = require("./conversation");
    clearHistory(phone);
    return `Bet — fresh start, we move 🔄\n\n${GREETING}`;
  }

  const history = loadHistory(phone);

  if (isSimpleGreeting(trimmed) && history.length === 0) {
    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", GREETING);
    return GREETING;
  }

  try {
    const searchQuery = buildSearchQuery(trimmed, history);
    const skipRag = isSimpleGreeting(trimmed);
    const knowledgeChunks = skipRag ? [] : await safeSearchKnowledge(searchQuery);
    const knowledgeContext = formatKnowledgeContext(knowledgeChunks);

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
      temperature: 0.65,
      top_p: 0.9,
      max_tokens: 800,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "ngl something went wrong on my end — try again in a sec or hit up Mr Odun directly.";

    addMessage(phone, "user", trimmed);
    addMessage(phone, "assistant", reply);

    return reply;
  } catch (err) {
    console.error("OpenAI error:", err.message, err.stack);

    const known = classifyOpenAIError(err);
    if (known) {
      return `ngl I'm having a tech issue rn 😅 (${known}) — try again shortly or reach Mr Odun directly.`;
    }

    return "ngl I'm having a technical moment rn 😅 Try again in a bit or reach Mr Odun directly.";
  }
}

module.exports = { generateReply, buildSearchQuery };
