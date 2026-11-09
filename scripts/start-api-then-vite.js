/**
 * start-api-then-vite.js
 *
 * Launches the ShrimPredict Flask AI API in the background,
 * then starts the Vite dev server in the foreground.
 *
 * Usage:  npm run dev          (from the frontend/ directory)
 *         node scripts/start-api-then-vite.js   (from project root)
 *
 * Pressing Ctrl+C stops both Vite and the API process.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// ── Resolve paths relative to project root (one level up from frontend/) ──
const projectRoot = path.resolve(__dirname, "..");
const pythonExe = path.join(projectRoot, ".venv311", "Scripts", "python.exe");
const flaskScript = path.join(projectRoot, "ml", "wssv_transfer", "flask_api.py");
const frontendDir = path.join(projectRoot, "frontend");

// ── Verify the virtual-environment Python exists ──
if (!fs.existsSync(pythonExe)) {
  console.error(
    `\x1b[31m[ERROR]\x1b[0m .venv311 virtual environment not found at:\n  ${pythonExe}`
  );
  process.exit(1);
}

// ── 1. Start the Flask AI API in the background ──
console.log(
  "\x1b[36m[ShrimPredict]\x1b[0m Starting Flask AI API on http://127.0.0.1:5001 ..."
);

const api = spawn(pythonExe, [flaskScript], {
  cwd: projectRoot,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

// Forward API output with a prefix so you can tell the two apart
api.stdout.on("data", (data) => {
  process.stdout.write(`\x1b[33m[API]\x1b[0m ${data}`);
});
api.stderr.on("data", (data) => {
  process.stderr.write(`\x1b[33m[API]\x1b[0m ${data}`);
});
api.on("error", (err) => {
  console.error(`\x1b[31m[API ERROR]\x1b[0m ${err.message}`);
});
api.on("exit", (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[31m[API]\x1b[0m Flask API exited with code ${code}`);
  }
});

// ── 2. Start Vite dev server in the foreground ──
console.log("\x1b[36m[ShrimPredict]\x1b[0m Starting Vite dev server ...\n");

const vite = spawn("npx", ["vite"], {
  cwd: frontendDir,
  stdio: "inherit",
  shell: true,
});

// ── 3. Clean up: kill API when Vite exits or user presses Ctrl+C ──
function cleanup() {
  if (!api.killed) {
    console.log("\n\x1b[36m[ShrimPredict]\x1b[0m Stopping Flask AI API ...");
    api.kill("SIGTERM");
  }
}

vite.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

