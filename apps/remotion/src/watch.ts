import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const compositionsDir = path.resolve(ROOT, "packages/remotion/src");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isRendering = false;

function render() {
  if (isRendering) {
    console.log("[remotion] Render already in progress, queuing...");
    scheduleRender();
    return;
  }

  isRendering = true;
  const start = performance.now();
  console.log("[remotion] Rendering video...");

  try {
    execSync("pnpm --filter @lightfast/remotion render:video", {
      cwd: ROOT,
      stdio: "inherit",
    });
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`[remotion] Video rendered in ${elapsed}s`);
  } catch {
    console.error("[remotion] Render failed");
  } finally {
    isRendering = false;
  }
}

function scheduleRender() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(render, 500);
}

render();

console.log("[remotion] Watching package source for changes...");

const watcher = fs.watch(
  compositionsDir,
  { recursive: true },
  (_event, filename) => {
    if (!filename) {
      return;
    }
    if (!/\.(ts|tsx|css)$/.test(filename)) {
      return;
    }
    console.log(`[remotion] Changed: ${filename}`);
    scheduleRender();
  }
);

process.on("SIGINT", () => {
  watcher.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  watcher.close();
  process.exit(0);
});
