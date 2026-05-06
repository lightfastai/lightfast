#!/usr/bin/env node
import { rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const productName = "Lightfast Dev";

// Mirror bootstrap.ts:10-12 — Electron resolves userData as join(appData, productName).
function resolveUserData() {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", productName);
    case "win32":
      return join(
        process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
        productName
      );
    case "linux":
      return join(
        process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
        productName
      );
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

// Only Chromium-managed *transient* caches. Excludes Local Storage, IndexedDB,
// Cookies — those carry app state. App-written files (settings.json, auth.bin,
// window-state.json) are at the root and untouched here.
//
// Names match Electron 41's userData layout. `Cache` is the HTTP cache;
// `DawnGraphiteCache`/`DawnWebGPUCache` are the WebGPU/Graphite shader caches
// (the plan-era `DawnGraphicsCache` does not exist on this version).
const SUBDIRS = [
  "Cache",
  "Code Cache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "Extensions",
  "GPUCache",
  "Service Worker",
];

const userData = resolveUserData();
let removed = 0;
for (const sub of SUBDIRS) {
  const target = join(userData, sub);
  try {
    statSync(target);
  } catch {
    continue;
  }
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${target}`);
  removed += 1;
}
console.log(`${removed}/${SUBDIRS.length} cache dirs cleared under ${userData}`);
