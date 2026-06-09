const fs = require("fs");
const path = require("path");
const config = require("./config");
const { getOpenAI } = require("./openai-client");

let cachedEmbeddings = null;

function loadEmbeddings() {
  if (cachedEmbeddings) return cachedEmbeddings;

  const filePath = config.paths.embeddings;
  if (!fs.existsSync(filePath)) {
    cachedEmbeddings = [];
    return cachedEmbeddings;
  }

  try {
    cachedEmbeddings = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return cachedEmbeddings;
  } catch {
    cachedEmbeddings = [];
    return cachedEmbeddings;
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchKnowledge(query) {
  const embeddings = loadEmbeddings();
  if (embeddings.length === 0) return [];

  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: query.slice(0, 500),
  });

  const queryVector = response.data[0].embedding;

  const ranked = embeddings
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryVector, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.conversation.maxContextChunks)
    .filter((item) => item.score > 0.3);

  return ranked;
}

function formatKnowledgeContext(chunks) {
  if (chunks.length === 0) {
    return "COMPANY KNOWLEDGE: Use general Mysogi sales assistant knowledge. For specific rates or policies, say you'll check the docs or escalate to Mr Odun if unsure.";
  }

  const sections = chunks.map(
    (chunk, i) =>
      `[Source ${i + 1}: ${chunk.source}]\n${chunk.text}`
  );

  return `COMPANY KNOWLEDGE (use this to answer — do not invent info beyond this):\n\n${sections.join("\n\n")}`;
}

module.exports = { searchKnowledge, formatKnowledgeContext, loadEmbeddings };
