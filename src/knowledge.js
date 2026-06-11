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

function loadCoreKnowledge() {
  const filePath = config.paths.coreKnowledge;
  if (!fs.existsSync(filePath)) return "";
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function dedupeChunks(chunks) {
  const seen = new Set();
  return chunks.filter((c) => {
    const key = c.text.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Multi-pass search: main query + individual keywords for better recall.
 */
const INTENT_FALLBACKS = [
  { pattern: /billboard|led|ooh|outdoor|signage|marina|lekki|vi\b|victoria/i, terms: ["billboard", "lagos", "outdoor", "led"] },
  { pattern: /abuja|fct|gwagwalada/i, terms: ["abuja", "billboard"] },
  { pattern: /meta|instagram|facebook|ig\b|snap|google|youtube|digital/i, terms: ["meta", "digital", "instagram"] },
  { pattern: /sms|voice|radio|tv|television/i, terms: ["sms", "voice", "radio"] },
  { pattern: /rate|price|cost|budget|how much|₦/i, terms: ["rate", "daily", "weekly", "monthly"] },
  { pattern: /pitch|objection|client|sell|close/i, terms: ["sales", "minimum", "budget"] },
];

function searchAll(query) {
  const limit = config.conversation.maxContextChunks;
  const primary = keywordSearch(query, limit);

  const terms = expandTerms(tokenize(query));
  const extra = [];
  for (const term of terms.slice(0, 5)) {
    extra.push(...keywordSearch(term, 2));
  }

  let results = dedupeChunks([...primary, ...extra]);

  if (results.length < 3) {
    for (const { pattern, terms: fallbackTerms } of INTENT_FALLBACKS) {
      if (pattern.test(query)) {
        for (const t of fallbackTerms) {
          extra.push(...keywordSearch(t, 2));
        }
        break;
      }
    }
    results = dedupeChunks([...primary, ...extra]);
  }

  if (results.length === 0) {
    const index = loadIndex();
    results = index
      .filter((c) => /₦|rate|daily|billboard|meta|sms/i.test(c.text))
      .slice(0, Math.min(5, limit));
  }

  return results.slice(0, limit);
}

function getKnowledgeContext(query) {
  const core = loadCoreKnowledge();
  const matches = searchAll(query);

  let context = `═══ MYSOGI COMPANY KNOWLEDGE BASE ═══
Use this for products, channels, rates, and sales guidance. Quote exact ₦ figures when present.

${core || "(Core knowledge file loading)"}`;

  if (matches.length > 0) {
    const excerpts = matches
      .map(
        (c, i) =>
          `--- DOC EXCERPT ${i + 1} (${c.source}) ---\n${c.text}`
      )
      .join("\n\n");

    context += `\n\n═══ MATCHING DOCUMENT EXCERPTS (exact source data) ═══
For rates, locations, specs — use EXACT numbers from these excerpts. Do not round.

${excerpts}`;
  }

  context += `\n\n═══ REASONING RULE ═══
If the exact answer is not in excerpts above, still answer intelligently using:
- The knowledge base above
- Your expertise in sales, marketing, advertising, and Nigerian market context
- Logical inference from related Mysogi products/rates in the docs
Only for specific Mysogi pricing or policy NOT in docs: give your best recommendation then say "confirm exact rate with Mr Odun if needed."
Never refuse to help. Never say "I don't have it in my documents" — always give a useful, complete answer.`;

  return context;
}

module.exports = { getKnowledgeContext, loadIndex, keywordSearch };
