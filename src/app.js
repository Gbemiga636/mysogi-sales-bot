const express = require("express");
const config = require("./config");
const { generateReply } = require("./chat");
const {
  sendTextMessage,
  markAsRead,
  extractTextMessages,
} = require("./whatsapp");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    bot: "Mr Odun's Sales Assistant",
    company: config.companyName,
    platform: process.env.VERCEL ? "vercel" : "local",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.warn("Webhook verification failed");
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const messages = extractTextMessages(req.body);
  if (messages.length === 0) {
    console.log("Webhook received (no text messages)");
    return;
  }

  for (const msg of messages) {
    console.log(`Message from ${msg.from}: ${msg.text.slice(0, 80)}`);
    try {
      await markAsRead(msg.id);
      const reply = await generateReply(msg.from, msg.text);
      await sendTextMessage(msg.from, reply);
      console.log(`Replied to ${msg.from}`);
    } catch (err) {
      console.error(`Error handling message from ${msg.from}:`, err.message);
      try {
        await sendTextMessage(
          msg.from,
          "ngl I'm having a technical moment rn 😅 Try again in a bit or reach Mr Odun directly."
        );
      } catch {
        console.error("Failed to send error message");
      }
    }
  }
});

module.exports = app;
