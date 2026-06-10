const config = require("./config");

const GRAPH_API = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;

async function sendMessage(payload) {
  const url = `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function sendTextMessage(to, text) {
  return sendMessage({
    to,
    type: "text",
    text: { preview_url: false, body: text },
  });
}

async function sendButtonMessage(to, bodyText) {
  return sendMessage({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "ask_ai", title: "✅ Got it, thanks" },
          },
          {
            type: "reply",
            reply: { id: "mr_odun", title: "📞 Talk to Mr Odun" },
          },
        ],
      },
    },
  });
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

function extractIncomingMessages(body) {
  const messages = [];

  if (body.object !== "whatsapp_business_account") return messages;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;

      for (const msg of value.messages) {
        const base = {
          id: msg.id,
          from: msg.from,
          timestamp: msg.timestamp,
          type: msg.type,
        };

        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            ...base,
            text: msg.text.body,
            contextId: msg.context?.id || null,
          });
        } else if (msg.type === "interactive") {
          const buttonId = msg.interactive?.button_reply?.id;
          const buttonTitle = msg.interactive?.button_reply?.title;
          const listId = msg.interactive?.list_reply?.id;
          const listTitle = msg.interactive?.list_reply?.title;

          if (buttonId) {
            messages.push({
              ...base,
              text: buttonId,
              buttonId,
              buttonTitle,
              contextId: msg.context?.id || null,
              isInteractive: true,
            });
          } else if (listId) {
            messages.push({
              ...base,
              text: listId,
              buttonId: listId,
              buttonTitle: listTitle,
              isInteractive: true,
            });
          }
        }
      }
    }
  }

  return messages;
}

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  markAsRead,
  extractIncomingMessages,
  extractTextMessages: extractIncomingMessages,
};
