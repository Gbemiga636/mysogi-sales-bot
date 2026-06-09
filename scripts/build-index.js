/** One-time: build lightweight search index from existing embeddings */
const fs = require("fs");
const path = require("path");

const embPath = path.join(__dirname, "../data/embeddings.json");
const outPath = path.join(__dirname, "../data/knowledge-index.json");

const embeddings = JSON.parse(fs.readFileSync(embPath, "utf8"));
const index = embeddings.map(({ text, source }) => ({ text, source }));
fs.writeFileSync(outPath, JSON.stringify(index));

console.log(`Built knowledge-index.json: ${index.length} chunks, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
