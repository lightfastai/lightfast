#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const pkg = JSON.parse(
  readFileSync(resolve(desktopRoot, "package.json"), "utf8")
);

const required = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
}

// Sentry release versions reject `/` and certain whitespace, so the scoped
// package name (`@lightfast/desktop`) cannot be used verbatim. Strip the
// leading `@` and replace the scope separator with `-` to yield
// `lightfast-desktop@<version>+<buildNumber>` — matches the Sentry project
// slug. Must produce the same string as `getSentryInitOptions` in
// `apps/desktop/src/main/sentry.ts`; keep both in sync.
const releaseName = pkg.name.replace(/^@/, "").replace("/", "-");
const release = `${releaseName}@${pkg.version}+${pkg.buildNumber}`;
const buildDir = resolve(desktopRoot, ".vite/build");
const rendererDir = resolve(desktopRoot, ".vite/renderer/main_window");

function sentry(args) {
  execFileSync("pnpm", ["exec", "sentry-cli", ...args], {
    cwd: desktopRoot,
    stdio: "inherit",
    env: process.env,
  });
}

// Modern artifact-bundle flow with debug-id matching. `sourcemaps inject`
// runs in `forge.config.ts`'s prePackage hook so the injected //# debugId=
// comments land in the asar; here we only `upload`. Stack frames in Sentry
// resolve via debug-id, which avoids URL-prefix mismatches between the
// uploaded path (`assets/index-*.js`) and the runtime frame
// (`app:///.vite/renderer/main_window/assets/index-*.js`).
sentry(["sourcemaps", "upload", "--release", release, buildDir]);
sentry(["sourcemaps", "upload", "--release", release, rendererDir]);
sentry(["releases", "finalize", release]);

console.log(`Uploaded sourcemaps for release ${release}`);
