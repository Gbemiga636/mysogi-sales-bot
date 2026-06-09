require("dotenv").config();

const app = require("./app");
const config = require("./config");
const { verifyOpenAI } = require("./openai-client");

if (!process.env.VERCEL) {
  app.listen(config.port, async () => {
    console.log(`Mr Odun's assistant running on port ${config.port}`);
    console.log(`Company: ${config.companyName}`);
    console.log(`OpenAI model: ${config.openai.model}`);

    if (config.openai.apiKey) {
      try {
        await verifyOpenAI();
        console.log("OpenAI: connected ✓");
      } catch (err) {
        console.error("OpenAI: connection failed —", err.message);
      }
    }
  });
}

module.exports = app;
