#!/usr/bin/env node

// Inject NEXT_PUBLIC_<SIBLING>_URL=$(portless get <sibling>.lightfast) for each
// related project before exec'ing the inner command. Keeps dev:app scripts
// terse:  `pnpm with-related-projects pnpm with-env next dev --turbo`.
//
// An already-set NEXT_PUBLIC_<SIBLING>_URL is preserved so a developer can
// override one sibling without losing the others. If `portless get` is not
// available (portless not installed / sibling unmapped), the var stays unset
// and origins.ts falls back to the zod default (the production literal).

import { spawn, spawnSync } from "node:child_process";

const SIBLINGS = [
  { envVar: "NEXT_PUBLIC_APP_URL", portlessName: "app.lightfast" },
  { envVar: "NEXT_PUBLIC_WWW_URL", portlessName: "www.lightfast" },
  { envVar: "NEXT_PUBLIC_PLATFORM_URL", portlessName: "platform.lightfast" },
];

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}

if (!args.length) {
  console.error(
    "Usage: node scripts/with-related-projects.mjs -- <command> [...args]"
  );
  process.exit(1);
}

const env = { ...process.env };
for (const { envVar, portlessName } of SIBLINGS) {
  if (env[envVar]) {
    continue;
  }
  const url = portlessGet(portlessName);
  if (url) {
    env[envVar] = url;
  }
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

function portlessGet(name) {
  const result = spawnSync("portless", ["get", name], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return undefined;
  }
  const url = result.stdout.trim();
  return url || undefined;
}
