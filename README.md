# Mysogi Sales WhatsApp Bot

Mr Odun's AI sales assistant for the Mysogi sales team on WhatsApp.

## Deploy on Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import [mysogi-sales-bot](https://github.com/Gbemiga636/mysogi-sales-bot)
3. Add **Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `OPENAI_API_KEY` | your OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `WHATSAPP_TOKEN` | permanent system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | your phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | your WABA ID |
| `VERIFY_TOKEN` | your verify token |
| `COMPANY_NAME` | `Mysogi` |

4. Deploy — copy your URL: `https://your-project.vercel.app`
5. Meta Developer → WhatsApp → Configuration → Webhook:
   - **Callback URL:** `https://your-project.vercel.app/webhook`
   - **Verify token:** same as `VERIFY_TOKEN`
6. Subscribe to **messages**
7. Run once locally: `npm run setup:whatsapp`

## Why Vercel

- **No 15-minute sleep** like Render free tier
- **Permanent HTTPS URL** — no tunnel needed
- Cold start ~1–3s after idle (fine for WhatsApp webhooks)

## Local development

```powershell
npm install
npm start              # Terminal 1
npm run tunnel         # Terminal 2
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup:whatsapp` | Subscribe app to WABA |
| `npm run webhook:status` | Check webhook setup |
| `npm run test:whatsapp` | Test token + send message |
| `npm run ingest` | Rebuild knowledge base |
