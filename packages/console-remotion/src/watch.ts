import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compositionsDir = path.resolve(__dirname, "compositions");
const _sharedDir = path.resolve(__dirname, "compositions/landing-hero/shared");

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
  console.log("[remotion] Rendering GIF...");

  try {
    execSync("npx tsx src/render.ts", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`[remotion] GIF rendered in ${elapsed}s`);
  } catch {
    console.error("[remotion] Render failed");
  } finally {
    isRendering = false;
  }
}

function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 500);
}

// Initial render
render();

// Watch compositions directory for changes
console.log("[remotion] Watching compositions for changes...");

const watcher = fs.watch(compositionsDir, { recursive: true }, (event, filename) => {
  if (!filename) return;
  // Only react to .ts/.tsx file changes
  if (!/\.(ts|tsx|css)$/.test(filename)) return;
  console.log(`[remotion] Changed: ${filename}`);
  scheduleRender();
});

process.on("SIGINT", () => {
  watcher.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  watcher.close();
  process.exit(0);
});
