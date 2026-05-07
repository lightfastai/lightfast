#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const pkg = JSON.parse(
  readFileSync(resolve(desktopRoot, "package.json"), "utf8")
);

const buildFlavors = new Set(["dev", "preview", "prod"]);
const signingModes = new Set(["ad-hoc", "developer-id"]);

const info = {
  name: pkg.name,
  version: pkg.version,
  buildFlavor: pkg.buildFlavor,
  buildNumber: pkg.buildNumber,
  sparkleFeedUrl: pkg.sparkleFeedUrl ?? "",
  signingMode: pkg.signingMode,
};

const errors = [];
if (!buildFlavors.has(info.buildFlavor)) {
  errors.push(
    `buildFlavor must be one of [dev|preview|prod], got ${JSON.stringify(info.buildFlavor)}`
  );
}
if (!signingModes.has(info.signingMode)) {
  errors.push(
    `signingMode must be one of [ad-hoc|developer-id], got ${JSON.stringify(info.signingMode)}`
  );
}
if (typeof info.buildNumber !== "string" || info.buildNumber.length === 0) {
  errors.push(
    `buildNumber must be a non-empty string, got ${JSON.stringify(info.buildNumber)}`
  );
}

if (errors.length > 0) {
  for (const e of errors) {
    console.error(e);
  }
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
