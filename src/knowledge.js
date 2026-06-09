const fs = require("fs");
const config = require("./config");

let cachedCore = null;
let cachedIndex = null;

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "its", "may", "new", "now", "old", "see", "way", "who", "did",
  "let", "say", "she", "too", "use", "what", "when", "where", "which",
  "with", "this", "that", "from", "have", "will", "your", "about", "they",
  "them", "then", "than", "been", "being", "would", "could", "should",
  "into", "just", "like", "make", "much", "need", "some", "very", "also",
]);

function loadCoreKnowledge() {
  if (cachedCore !== null) return cachedCore;

  const filePath = config.paths.coreKnowledge;
  if (!fs.existsSync(filePath)) {
    cachedCore = "";
    return cachedCore;
  }

  try {
    cachedCore = fs.readFileSync(filePath, "utf8").trim();
  } catch {
    cachedCore = "";
  }
  return cachedCore;
}

function loadIndex() {
  if (cachedIndex !== null) return cachedIndex;

  const filePath = config.paths.knowledgeIndex;
  if (!fs.existsSync(filePath)) {
    cachedIndex = [];
    return cachedIndex;
  }

  try {
    cachedIndex = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    cachedIndex = [];
  }
  return cachedIndex;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s₦]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function keywordSearch(query, limit = 3) {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const index = loadIndex();

  return index
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) score += 1;
      }
      // Boost exact multi-word matches
      const q = query.toLowerCase();
      if (q.length > 4 && text.includes(q)) score += 5;
      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Fast knowledge lookup — no OpenAI API call, no 6MB file load.
 * Always includes core sales KB + top keyword-matched doc excerpts.
 */
function getKnowledgeContext(query) {
  const core = loadCoreKnowledge();
  const matches = keywordSearch(query);

  let context = "";

  if (core) {
    context += `MYSOGI CORE KNOWLEDGE (always accurate — use for rates, products, channels):\n\n${core}`;
  }

  if (matches.length > 0) {
    const excerpts = matches
      .map((c, i) => `[Detail ${i + 1} from ${c.source}]\n${c.text}`)
      .join("\n\n");
    context += `\n\nEXTRA DETAILS FOR THIS QUESTION:\n${excerpts}`;
  }

  if (!context) {
    return "COMPANY KNOWLEDGE: Use general Mysogi sales best practices. Escalate to Mr Odun if unsure.";
  }

  return context;
}

module.exports = { getKnowledgeContext, loadCoreKnowledge, loadIndex, keywordSearch };
