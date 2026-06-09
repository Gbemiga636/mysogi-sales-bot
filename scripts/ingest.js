/**
 * Ingest company documents + Mr Odun chat exports into the knowledge base.
 *
 * Usage:
 *   1. Put PDFs/DOCX/TXT in data/documents/
 *   2. Put WhatsApp chat exports (.txt) in data/chats/
 *   3. Run: npm run ingest
 */

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const OpenAI = require("openai");
require("dotenv").config();

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MIN_TEXT_CHARS = 100;
const MANAGER_NAMES = ["mr odun", "odun", "mr. odun", "odunayo"];

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = "text-embedding-3-small";

async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === ".pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if ([".txt", ".md", ".csv"].includes(ext)) {
    return buffer.toString("utf8");
  }
  return null;
}

function normalizePdfText(text) {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/₦/g, "₦ ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, source) {
  const cleaned = normalizePdfText(text);
  if (!cleaned || cleaned.length < MIN_TEXT_CHARS) return [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    chunks.push({ text: cleaned.slice(start, end), source });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

function parseWhatsAppChat(content) {
  const lines = content.split("\n");
  const messages = [];

  for (const line of lines) {
    const match = line.match(
      /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\]\s*(.+?):\s(.+)$/i
    );
    if (!match) continue;

    const [, , sender, text] = match;
    const senderLower = sender.toLowerCase();

    const isManager = MANAGER_NAMES.some((name) =>
      senderLower.includes(name)
    );

    if (isManager && text.trim().length > 5) {
      messages.push(text.trim());
    }
  }

  return messages;
}

async function embedChunks(chunks) {
  const results = [];
  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((c) => c.text),
    });

    for (let j = 0; j < batch.length; j++) {
      results.push({
        text: batch[j].text,
        source: batch[j].source,
        embedding: response.data[j].embedding,
      });
    }

    console.log(`Embedded ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
  }

  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required in .env");
    process.exit(1);
  }

  const root = process.cwd();
  const docsDir = path.join(root, "data/documents");
  const chatsDir = path.join(root, "data/chats");

  for (const dir of [docsDir, chatsDir]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const allChunks = [];

  const rulesPath = path.join(root, "data/rules.txt");
  if (fs.existsSync(rulesPath)) {
    console.log("Reading bot rules: data/rules.txt");
    const rules = fs.readFileSync(rulesPath, "utf8");
    allChunks.push(...chunkText(rules, "rules.txt"));
  }

  const docFiles = fs
    .readdirSync(docsDir)
    .filter((f) => !f.startsWith(".") && !f.startsWith("_"));

  for (const file of docFiles) {
    const filePath = path.join(docsDir, file);
    const { size } = fs.statSync(filePath);

    if (size > MAX_FILE_BYTES) {
      console.log(`Skipping large file (${Math.round(size / 1e6)}MB): ${file}`);
      continue;
    }

    console.log(`Reading document: ${file}`);
    try {
      const content = await readFileContent(filePath);
      if (content) {
        const chunks = chunkText(content, file);
        if (chunks.length === 0) {
          console.log(`  Skipped (no usable text): ${file}`);
        } else {
          console.log(`  ${chunks.length} chunks`);
          allChunks.push(...chunks);
        }
      }
    } catch (err) {
      console.log(`  Skipped (read error): ${file} — ${err.message}`);
    }
  }

  const styleExamples = [];
  const chatFiles = fs.readdirSync(chatsDir).filter((f) => f.endsWith(".txt"));
  for (const file of chatFiles) {
    const filePath = path.join(chatsDir, file);
    console.log(`Reading chat export: ${file}`);
    const content = fs.readFileSync(filePath, "utf8");

    const managerMessages = parseWhatsAppChat(content);
    styleExamples.push(...managerMessages);

    for (const msg of managerMessages) {
      allChunks.push({
        text: `Mr Odun said: "${msg}"`,
        source: `chat:${file}`,
      });
    }
  }

  if (styleExamples.length > 0) {
    const unique = [...new Set(styleExamples)].slice(0, 30);
    fs.writeFileSync(
      path.join(root, "data/style-examples.json"),
      JSON.stringify({ examples: unique }, null, 2)
    );
    console.log(`Saved ${unique.length} Mr Odun style examples`);
  }

  if (allChunks.length === 0) {
    console.log("\nNo files found.");
    console.log("Add files to data/documents/ and data/chats/ then run again.");
    return;
  }

  console.log(`\nTotal chunks to embed: ${allChunks.length}`);
  const embeddings = await embedChunks(allChunks);

  fs.writeFileSync(
    path.join(root, "data/embeddings.json"),
    JSON.stringify(embeddings)
  );

  console.log(`\nDone! Saved ${embeddings.length} chunks to data/embeddings.json`);
  console.log("Restart the bot (or redeploy on Render) to use the new knowledge.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
