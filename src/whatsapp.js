const config = require("./config");

const GRAPH_API = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;

async function sendTextMessage(to, text) {
  const url = `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function markAsRead(messageId) {
  const url = `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {});
}

function extractTextMessages(body) {
  const messages = [];

  if (body.object !== "whatsapp_business_account") return messages;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;

      for (const msg of value.messages) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            id: msg.id,
            from: msg.from,
            text: msg.text.body,
            timestamp: msg.timestamp,
          });
        }
      }
    }
  }

  return messages;
}

module.exports = { sendTextMessage, markAsRead, extractTextMessages };
