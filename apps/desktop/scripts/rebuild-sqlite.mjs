#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { argv, exit } from "node:process";
// Rebuild better-sqlite3 against either Electron's or Node's ABI.
// `pnpm rebuild:sqlite` (Electron) for `pnpm dev` / packaged smoke.
// `pnpm rebuild:sqlite:node` (Node) before running vitest after a dev cycle.
import { rebuild } from "@electron/rebuild";

const target = argv.includes("--target=node") ? "node" : "electron";
const cwd = resolve(import.meta.dirname, "..");

if (target === "electron") {
  // Resolve Electron's bundled Node ABI from the installed Electron package.
  const electronVersion = execFileSync(
    "node",
    ["-p", "require('electron/package.json').version"],
    { cwd, encoding: "utf8" }
  ).trim();
  await rebuild({
    buildPath: cwd,
    electronVersion,
    onlyModules: ["better-sqlite3"],
    force: true,
  });
  console.log(`[rebuild-sqlite] rebuilt against Electron ${electronVersion}`);
} else {
  // Restore Node-ABI prebuilt by re-running better-sqlite3's install hook.
  execFileSync("pnpm", ["rebuild", "better-sqlite3"], {
    cwd,
    stdio: "inherit",
  });
  console.log("[rebuild-sqlite] rebuilt against host Node");
}

exit(0);
