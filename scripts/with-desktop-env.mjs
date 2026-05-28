#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDetectWorktreePrefix } from "@lightfastai/dev-core";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const PORTLESS_CA_PATH = path.join(homedir(), ".portless", "ca.pem");
const AGGREGATE_PORTLESS_NAME = "lightfast";
const args = process.argv.slice(2);

if (args[0] === "--") {
  args.shift();
}

const env = buildEnv();

if (args[0] === "--print") {
  printEnv(env);
  process.exit(0);
}

if (!args.length) {
  console.error(
    "Usage: node scripts/with-desktop-env.mjs -- <command> [...args]"
  );
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  }
  process.exit(code ?? 0);
});

function buildEnv() {
  const appOrigin = resolveDesktopAppOrigin(process.env);
  return {
    ...process.env,
    LIGHTFAST_APP_ORIGIN: appOrigin,
    ...portlessNodeCaEnv(appOrigin, process.env),
  };
}

// Electron's main process inherits Node's undici fetch as the `fetch`
// global, and Node's CA bundle does not include portless's local root
// (~/.portless/ca.pem). Any HTTPS request from main against the dev
// aggregate (https://*.localhost) therefore fails the TLS handshake
// with SELF_SIGNED_CERT_IN_CHAIN. Inject the Portless CA here so a fresh
// contributor shell doesn't need the env var pre-exported in shellrc.
//
// Longer-term, the more architecturally correct fix is to switch the
// main-process fetch in apps/desktop/src/main/auth-flow.ts (and any
// future Node fetches) to Electron's `net.fetch` from `electron`'s
// `net` module, which routes through Chromium's networking and trusts
// the macOS keychain. That removes the need for this env injection.
// Tracked in
// thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md.
function portlessNodeCaEnv(appOrigin, env) {
  if (env.NODE_EXTRA_CA_CERTS) {
    return {};
  }
  let hostname;
  try {
    hostname = new URL(appOrigin).hostname;
  } catch {
    return {};
  }
  const isLocalhost =
    hostname === "localhost" || hostname.endsWith(".localhost");
  if (!isLocalhost) {
    return {};
  }
  if (!existsSync(PORTLESS_CA_PATH)) {
    return {};
  }
  return { NODE_EXTRA_CA_CERTS: PORTLESS_CA_PATH };
}

function resolveDesktopAppOrigin(env) {
  if (env.LIGHTFAST_APP_ORIGIN) {
    return toOrigin(env.LIGHTFAST_APP_ORIGIN, "LIGHTFAST_APP_ORIGIN");
  }

  return toOrigin(
    readPortlessUrl(AGGREGATE_PORTLESS_NAME) ?? localAggregateUrl(env),
    "Portless MFE URL"
  );
}

function readPortlessUrl(name) {
  try {
    return execFileSync("portless", ["get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function localAggregateUrl(env) {
  const protocol = isHttpsEnabled(env) ? "https" : "http";
  const port = parsePort(env.PORTLESS_PORT) ?? (protocol === "https" ? 443 : 80);
  const portSuffix = shouldIncludePort(protocol, port) ? `:${port}` : "";
  const tld = env.PORTLESS_TLD || "localhost";
  const prefix = defaultDetectWorktreePrefix(repoRoot);
  const host = prefix
    ? `${prefix}.${AGGREGATE_PORTLESS_NAME}.${tld}`
    : `${AGGREGATE_PORTLESS_NAME}.${tld}`;

  return `${protocol}://${host}${portSuffix}`;
}

function isHttpsEnabled(env) {
  return env.PORTLESS_HTTPS !== "0" && env.PORTLESS_HTTPS !== "false";
}

function parsePort(value) {
  if (!value) {
    return undefined;
  }
  const port = Number.parseInt(String(value), 10);
  return Number.isInteger(port) && port > 0 && port < 65_536
    ? port
    : undefined;
}

function shouldIncludePort(protocol, port) {
  return Boolean(port) &&
    !((protocol === "https" && port === 443) ||
      (protocol === "http" && port === 80));
}

function toOrigin(rawUrl, label) {
  try {
    return new URL(rawUrl).origin;
  } catch {
    throw new Error(
      `${label} must be a valid absolute URL. Received: ${rawUrl}`
    );
  }
}

function printEnv(env) {
  console.log(`LIGHTFAST_APP_ORIGIN=${env.LIGHTFAST_APP_ORIGIN}`);
  if (env.NODE_EXTRA_CA_CERTS) {
    console.log(`NODE_EXTRA_CA_CERTS=${env.NODE_EXTRA_CA_CERTS}`);
  }
}
