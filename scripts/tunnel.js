require("dotenv").config();
const { spawn } = require("child_process");

const port = process.env.PORT || "3000";
const url = `http://localhost:${port}`;

console.log(`Starting tunnel → ${url}`);
console.log("(Must match the port your bot uses — check PORT in .env)\n");

const child = spawn("cloudflared", ["tunnel", "--url", url], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
