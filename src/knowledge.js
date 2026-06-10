const fs = require("fs");
const config = require("./config");

let cachedIndex = null;

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "its", "may", "new", "now", "old", "see", "way", "who", "did",
  "let", "say", "she", "too", "use", "what", "when", "where", "which",
  "with", "this", "that", "from", "have", "will", "your", "about", "they",
  "them", "then", "than", "been", "being", "would", "could", "should",
  "into", "just", "like", "make", "much", "need", "some", "very", "also",
  "tell", "please", "want", "know", "give", "there", "their",
]);

const PHRASE_BOOSTS = [
  "broad street", "eko hotel", "akin adesola", "lekki-ikoyi", "lekki ikoyi",
  "adetokumbo", "ojodu", "omole", "mma2", "airport", "abuja", "victoria island",
  "smart sms", "voice ads", "rate card", "google display", "meta ads",
  "instagram", "facebook", "snapchat", "youtube", "billboard", "minimum budget",
  "cool fm", "wazobia", "naija info", "africa magic", "supersport", "publication",
  "influencer", "app download", "uac", "led", "ooh", "marina", "lekki",
];

const SYNONYMS = {
  billboard: ["led", "ooh", "display", "outdoor"],
  instagram: ["meta", "ig", "facebook"],
  facebook: ["meta", "ig", "instagram"],
  sms: ["smart sms", "text message"],
  price: ["rate", "cost", "budget", "₦"],
  rate: ["price", "cost", "budget"],
  cheap: ["minimum", "budget", "affordable"],
  lagos: ["vi", "victoria island", "lekki", "island", "mainland"],
};

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

function expandTerms(terms) {
  const expanded = new Set(terms);
  for (const term of terms) {
    const syns = SYNONYMS[term];
    if (syns) syns.forEach((s) => expanded.add(s));
  }
  return [...expanded];
}

function keywordSearch(query, limit) {
  const terms = expandTerms(tokenize(query));
  const qLower = query.toLowerCase();
  const index = loadIndex();

  if (terms.length === 0 && index.length > 0) {
    return index.slice(0, Math.min(3, limit));
  }

  return index
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (text.includes(term)) score += 2;
      }

      for (const phrase of PHRASE_BOOSTS) {
        if (qLower.includes(phrase) && text.includes(phrase)) score += 8;
      }

      if (qLower.length > 5 && text.includes(qLower)) score += 10;

      if (
        /₦|\d{1,3},\d{3}|\d{3,}/.test(chunk.text) &&
        /price|rate|cost|budget|daily|weekly|monthly|₦|how much/i.test(query)
      ) {
        score += 4;
      }

      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Pull exact excerpts from ingested company documents (PDFs).
 * Document chunks are PRIMARY — never replaced by summaries.
 */
function getKnowledgeContext(query) {
  const limit = config.conversation.maxContextChunks;
  const matches = keywordSearch(query, limit);

  if (matches.length === 0) {
    return `OFFICIAL COMPANY DOCUMENTS: No matching excerpt found for this question.
Tell the rep honestly you don't have that specific info in the docs — say to confirm with Mr Odun. Do NOT guess rates or policies.`;
  }

  const excerpts = matches
    .map(
      (c, i) =>
        `--- DOCUMENT EXCERPT ${i + 1} (source: ${c.source}) ---\n${c.text}`
    )
    .join("\n\n");

  return `OFFICIAL MYSOGI DOCUMENT DATA — USE EXACT FIGURES FROM HERE:
The excerpts below are taken directly from Mysogi's official documents (rate cards, billboard briefs, proposals).
You MUST use the exact numbers, rates, locations, and specs from these excerpts.
Do NOT round, estimate, or summarize prices. If a rate shows a range, give the full range exactly as written.
If the excerpt has Daily/Weekly/Monthly, list all that apply.

${excerpts}`;
}

module.exports = { getKnowledgeContext, loadIndex, keywordSearch };
