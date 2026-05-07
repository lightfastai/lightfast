#!/usr/bin/env node
import { chromium } from "@playwright/test";

const port = Number(process.env.LIGHTFAST_REMOTE_DEBUG_PORT ?? 9222);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(
    `LIGHTFAST_REMOTE_DEBUG_PORT must be an integer in [1, 65535], got ${process.env.LIGHTFAST_REMOTE_DEBUG_PORT}`
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const execIdx = argv.indexOf("--exec");
const expr = execIdx >= 0 ? argv[execIdx + 1] : null;
if (execIdx >= 0 && !expr) {
  console.error("--exec requires a JS expression");
  process.exit(1);
}

let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
} catch (err) {
  console.error(`Could not attach to CDP at 127.0.0.1:${port}: ${err.message}`);
  console.error("Hint: start the dev app with");
  console.error(`  LIGHTFAST_REMOTE_DEBUG_PORT=${port} pnpm dev:desktop`);
  process.exit(1);
}

const contexts = browser.contexts();
const pages = contexts.flatMap((ctx) => ctx.pages());

if (pages.length === 0) {
  console.error("No pages attached. Is the renderer up?");
  await browser.close();
  process.exit(1);
}

console.log(`pages (${pages.length}):`);
for (const [i, page] of pages.entries()) {
  const url = page.url();
  const title = await page.title().catch(() => "<unavailable>");
  console.log(`  [${i}] ${title} — ${url}`);
}

if (expr) {
  const result = await pages[0].evaluate(expr);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await browser.close();
