const express = require("express");
const config = require("./config");
const { generateReply } = require("./chat");
const { isMrOdun, handleMrOdunMessage } = require("./escalation");
const {
  sendTextMessage,
  markAsRead,
  extractIncomingMessages,
} = require("./whatsapp");

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    bot: "Mr Odun's Sales Assistant",
    company: config.companyName,
    platform: process.env.VERCEL ? "vercel" : "local",
    model: config.openai.model,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    openai: Boolean(config.openai.apiKey),
    openaiModel: config.openai.model,
    whatsapp: Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId),
    mrOdunEscalation: Boolean(config.manager.phone),
  });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const inboundPhoneId =
    req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  const myPhoneId = config.whatsapp.phoneNumberId;

  if (inboundPhoneId && inboundPhoneId !== myPhoneId) {
    console.log(`Ignoring webhook for other number: ${inboundPhoneId}`);
    return res.sendStatus(200);
  }

  const messages = extractIncomingMessages(req.body);

  if (messages.length === 0) {
    return res.sendStatus(200);
  }

  try {
    for (const msg of messages) {
      const label = msg.buttonTitle || msg.text;
      console.log(`Message from ${msg.from}: ${label.slice(0, 80)}`);

      try {
        await markAsRead(msg.id);

        // Mr Odun replying → forward to the exact sales rep
        if (isMrOdun(msg.from)) {
          const result = await handleMrOdunMessage(msg.text, msg.contextId);
          await sendTextMessage(msg.from, result.text);
          console.log(`Mr Odun reply routed`);
          continue;
        }

        // Normal sales rep → AI assistant
        const result = await generateReply(msg.from, msg.text);
        await sendTextMessage(msg.from, result.text);
        console.log(`Replied to ${msg.from}`);
      } catch (err) {
        console.error(`Error from ${msg.from}:`, err.message);
        try {
          await sendTextMessage(
            msg.from,
            `Something went wrong on my end 😅 Try again or type *mr odun* to reach Mr Odun.`
          );
        } catch {
          console.error("Failed to send error message");
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = app;
