/**
 * E2E smoke runner (see docs/ARCHITECTURE.md): serves the built dist/ with a
 * tiny static server, launches headless Chromium, and runs every scenario in
 * ./scenarios against a stubbed office.js (./stub.mjs). Each scenario gets a
 * fresh browser context (isolated IndexedDB).
 *
 *   npm run build && npm run test:e2e
 *
 * Chromium resolution: CHROMIUM_BIN env var, else /opt/pw-browsers/chromium,
 * else whatever `google-chrome` is on PATH (GitHub Actions runners).
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const DIST = fileURLToPath(new URL("../../dist", import.meta.url));
const PORT = 8231;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".xml": "application/xml",
  ".json": "application/json",
};

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      const rel = normalize(url.pathname).replace(/^([/\\])+/, "");
      const file = join(DIST, rel === "" ? "index.html" : rel);
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

function chromiumPath() {
  if (process.env.CHROMIUM_BIN) {
    return process.env.CHROMIUM_BIN;
  }
  if (existsSync("/opt/pw-browsers/chromium")) {
    return "/opt/pw-browsers/chromium";
  }
  try {
    return execSync("which google-chrome || which chromium-browser || which chromium", {
      encoding: "utf8",
    })
      .split("\n")[0]
      .trim();
  } catch {
    throw new Error("No Chromium found. Set CHROMIUM_BIN.");
  }
}

const SCENARIOS = ["core", "features", "report", "builder", "rich"];

const results = [];
function makeCheck(scenario) {
  return (label, condition) => {
    results.push({ scenario, label, pass: Boolean(condition) });
    if (!condition) {
      console.error(`  ✗ ${label}`);
    } else {
      console.log(`  ✓ ${label}`);
    }
  };
}

if (!existsSync(join(DIST, "taskpane.html"))) {
  console.error("dist/taskpane.html missing — run `npm run build` first.");
  process.exit(2);
}

const server = await startServer();
const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
const baseUrl = `http://127.0.0.1:${PORT}`;

let crashed = false;
for (const name of SCENARIOS) {
  console.log(`\n── ${name}`);
  const { run } = await import(`./scenarios/${name}.mjs`);
  const context = await browser.newContext({ viewport: { width: 350, height: 750 } });
  try {
    await run({ context, baseUrl, check: makeCheck(name) });
  } catch (e) {
    crashed = true;
    results.push({ scenario: name, label: `scenario crashed: ${e.message}`, pass: false });
    console.error(`  ✗ scenario crashed: ${e.message}`);
  } finally {
    await context.close();
  }
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0 || crashed) {
  process.exit(1);
}
