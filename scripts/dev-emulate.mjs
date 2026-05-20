#!/usr/bin/env node

// Boots emulate@0.5.0 (Google OAuth) + ngrok tunnel for OAuth E2E.
// Tunnel is pinned to a reserved static domain (see NGROK_STATIC_DOMAIN
// below), so the discovery URL stays stable across restarts and Clerk
// dashboard only needs configuring once.
//
// Idempotent: detects already-running emulator on port 4000 and ngrok
// tunnel on the same port; reuses both rather than double-spawning.
//
// See thoughts/shared/plans/2026-05-14-dev-emulate-ngrok-static-domain.md.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const EMULATOR_PORT = 4000;
const NGROK_LOCAL_API_PORTS = Array.from({ length: 11 }, (_, i) => 4040 + i);
const ENV_FILE = path.join(repoRoot, "apps/app/.vercel/.env.development.local");
const SEED_FILE = path.join(repoRoot, "scripts/dev-emulate.seed.yaml");
// ngrok reserved static domain under the *.local.lghtfst.com wildcard.
// Naming convention: <purpose>-<identity>.local.lghtfst.com — flat single
// label under .local so the existing wildcard cert covers it (RFC 6125
// wildcards match exactly one label deep). Teammates / CI runners /
// staging envs swap the identity half: oauth-alice, oauth-ci-r1234,
// oauth-staging, etc. No DNS or ACME work per new name.
const NGROK_STATIC_DOMAIN = "oauth-jp.local.lghtfst.com";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const signals = ["SIGINT", "SIGTERM"];
const children = [];
let shuttingDown = false;

for (const signal of signals) {
  process.on(signal, () => shutdown(signal));
}

try {
  await main();
} catch (error) {
  console.error(`[dev:emulate] ${error instanceof Error ? error.message : error}`);
  shutdown("SIGTERM");
  process.exit(1);
}

async function main() {
  const frontendApi = deriveClerkFrontendApi();
  const redirectUri = `https://${frontendApi}/v1/oauth_callback`;

  const ngrokUrl = await ensureNgrokForStaticDomain(EMULATOR_PORT);

  writeSeedFile(SEED_FILE, redirectUri);

  const emulatorState = await detectEmulator(EMULATOR_PORT);
  if (emulatorState.running) {
    if (emulatorState.issuer && emulatorState.issuer.replace(/\/$/, "") === ngrokUrl) {
      log(`emulator already running on :${EMULATOR_PORT} with matching base-url — reusing`);
    } else {
      throw new Error(
        `port ${EMULATOR_PORT} is in use but its discovery issuer (${emulatorState.issuer ?? "unknown"}) does not match the current ngrok URL (${ngrokUrl}). Stop the existing emulator (e.g. \`lsof -ti :${EMULATOR_PORT} | xargs kill\`) and re-run.`,
      );
    }
  } else {
    startEmulator(ngrokUrl);
    await waitForEmulator(ngrokUrl);
  }

  printReadyBanner({ ngrokUrl, frontendApi });

  await new Promise(() => {
    // Keep the parent alive until SIGINT/SIGTERM.
  });
}

// ─── Clerk env wiring ────────────────────────────────────────────────────

function deriveClerkFrontendApi() {
  if (!existsSync(ENV_FILE)) {
    throw new Error(
      `${path.relative(repoRoot, ENV_FILE)} not found. Run \`cd apps/app && vercel env pull\` first.`,
    );
  }
  const content = readFileSync(ENV_FILE, "utf8");
  const match = content.match(/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=(.*)$/m);
  if (!match) {
    throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing from env file");
  }
  const value = match[1].replace(/^["']|["']$/g, "").trim();
  if (!value.startsWith("pk_test_")) {
    throw new Error(
      "dev:emulate refuses non-test Clerk keys. Publishable key must be pk_test_*.",
    );
  }
  const encoded = value.slice("pk_test_".length);
  const decoded = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  if (!decoded) {
    throw new Error("failed to decode Clerk publishable key host");
  }
  return decoded;
}

// ─── ngrok ───────────────────────────────────────────────────────────────

async function ensureNgrokForStaticDomain(port) {
  const expectedUrl = `https://${NGROK_STATIC_DOMAIN}`;
  const existing = await fetchNgrokUrlForPort(port);
  if (existing) {
    if (existing.replace(/\/$/, "") !== expectedUrl) {
      throw new Error(
        `ngrok already tunneling :${port} → ${existing}, but expected ${expectedUrl}. Stop the existing ngrok process and re-run.`,
      );
    }
    log(`ngrok already tunneling :${port} → ${existing} — reusing`);
    return existing;
  }
  log(`starting ngrok for port ${port} → ${expectedUrl}…`);
  const child = spawn(
    "ngrok",
    ["http", `--url=${NGROK_STATIC_DOMAIN}`, String(port)],
    {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "inherit"],
      detached: process.platform !== "win32",
    },
  );
  registerChild(child, "ngrok");
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(500);
    const url = await fetchNgrokUrlForPort(port);
    if (url) return url;
  }
  throw new Error("timed out waiting for ngrok to advertise its tunnel URL");
}

async function fetchNgrokTunnels() {
  const allTunnels = [];
  for (const port of NGROK_LOCAL_API_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/tunnels`);
      if (!res.ok) {
        continue;
      }
      const data = await res.json();
      if (Array.isArray(data?.tunnels)) {
        allTunnels.push(...data.tunnels);
      }
    } catch {
      // ngrok picks the next available API port when 4040 is occupied.
    }
  }
  return allTunnels.length ? allTunnels : null;
}

async function fetchNgrokUrlForPort(port) {
  const tunnels = await fetchNgrokTunnels();
  if (!tunnels) return null;
  const tunnel = tunnels.find(
    (t) =>
      t.proto === "https" &&
      typeof t.config?.addr === "string" &&
      t.config.addr.endsWith(`:${port}`),
  );
  return tunnel?.public_url ?? null;
}

// ─── emulator ────────────────────────────────────────────────────────────

function writeSeedFile(filePath, redirectUri) {
  // If the seed already exists, only update its redirect_uri — preserve any
  // additional users the developer added (the file is gitignored and intended
  // to be edited locally for row-specific test emails). On a fresh checkout
  // (no file yet), bootstrap with the default `testuser@example.com`.
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf8");
    const updated = existing.replace(
      /(redirect_uris:\s*\n\s*-\s*)(https:\/\/[^\s]+)/,
      `$1${redirectUri}`,
    );
    if (updated !== existing) {
      writeFileSync(filePath, updated, "utf8");
    }
    return;
  }
  const yaml = `# Auto-generated by scripts/dev-emulate.mjs on first run.
# Subsequent runs only update redirect_uris; any \`users:\` you add are
# preserved. The file is gitignored — local edits are expected.

google:
  users:
    - email: testuser@example.com
      name: Test User
      picture: https://lh3.googleusercontent.com/a/default-user
      email_verified: true
  oauth_clients:
    - client_id: test-idp-client-id.apps.googleusercontent.com
      client_secret: GOCSPX-test-idp-secret
      name: Lightfast Test IdP
      redirect_uris:
        - ${redirectUri}
`;
  writeFileSync(filePath, yaml, "utf8");
}

async function detectEmulator(port) {
  // HTTP probe is the authoritative check — net.createServer() can give
  // false negatives on macOS dual-stack binds (IPv4-only probe vs an
  // emulator listening on `::`).
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/.well-known/openid-configuration`,
      { signal: AbortSignal.timeout(1500) },
    );
    if (!res.ok) return { running: true, issuer: null };
    const data = await res.json();
    return {
      running: true,
      issuer: typeof data?.issuer === "string" ? data.issuer : null,
    };
  } catch (err) {
    // ECONNREFUSED / timeout / DNS — port is free or unresponsive.
    if (err?.name === "AbortError" || err?.cause?.code === "ECONNREFUSED") {
      return { running: false };
    }
    return { running: true, issuer: null };
  }
}

function startEmulator(ngrokUrl) {
  log(`starting emulate@0.5.0 on port ${EMULATOR_PORT} with base-url ${ngrokUrl}…`);
  const child = spawn(
    "npx",
    [
      "--yes",
      "emulate@0.5.0",
      "start",
      "--service",
      "google",
      "--port",
      String(EMULATOR_PORT),
      "--base-url",
      ngrokUrl,
      "--seed",
      SEED_FILE,
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "inherit", "inherit"],
      detached: process.platform !== "win32",
      env: process.env,
    },
  );
  registerChild(child, "emulator");
}

async function waitForEmulator(ngrokUrl) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(500);
    const state = await detectEmulator(EMULATOR_PORT);
    if (state.running && state.issuer?.replace(/\/$/, "") === ngrokUrl) {
      return;
    }
  }
  throw new Error(
    `emulator failed to come up with issuer=${ngrokUrl} on port ${EMULATOR_PORT} within 15s`,
  );
}

// ─── child lifecycle ─────────────────────────────────────────────────────

function registerChild(child, label) {
  children.push({ child, label });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[dev:emulate] ${label} exited unexpectedly (code=${code} signal=${signal})`,
    );
    shutdown(signal ?? "SIGTERM");
  });
}

function shutdown(signal) {
  if (shuttingDown) {
    process.kill(process.pid, signal);
    return;
  }
  shuttingDown = true;
  for (const { child } of children) {
    if (child.pid && !child.killed) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    }
  }
  setTimeout(() => process.exit(signalExitCode(signal)), 200).unref();
}

function signalExitCode(signal) {
  return 128 + (signal === "SIGINT" ? 2 : 15);
}

// ─── output ──────────────────────────────────────────────────────────────

function printReadyBanner({ ngrokUrl, frontendApi }) {
  const discovery = `${ngrokUrl}/.well-known/openid-configuration`;
  const sep = "─".repeat(72);
  console.log("");
  console.log(sep);
  console.log("[dev:emulate] Ready");
  console.log(`  Emulator       http://localhost:${EMULATOR_PORT}`);
  console.log(`  Tunnel         ${ngrokUrl}  (static)`);
  console.log(`  Frontend API   ${frontendApi}`);
  console.log(`  Discovery      ${discovery}`);
  console.log(sep);
  console.log("");
  console.log("Press Ctrl-C to stop.");
}

function log(message) {
  console.log(`[dev:emulate] ${message}`);
}

function printHelp() {
  console.log(
    `Usage: pnpm dev:emulate
Boots emulate@0.5.0 (Google OAuth) on :${EMULATOR_PORT} + ngrok tunnel at
https://${NGROK_STATIC_DOMAIN}. Idempotent. pk_test_ keys only.`,
  );
}

// ─── utilities ───────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
