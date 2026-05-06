#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePortlessMfeUrl } from "@lightfastai/dev-proxy";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
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
  return {
    ...process.env,
    LIGHTFAST_APP_ORIGIN: resolveDesktopAppOrigin(process.env),
  };
}

function resolveDesktopAppOrigin(env) {
  if (env.LIGHTFAST_APP_ORIGIN) {
    return toOrigin(env.LIGHTFAST_APP_ORIGIN, "LIGHTFAST_APP_ORIGIN");
  }

  return toOrigin(
    resolvePortlessMfeUrl({
      cwd: repoRoot,
      env,
    }),
    "Portless MFE URL"
  );
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
}
