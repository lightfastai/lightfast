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

const release = `${pkg.name}@${pkg.version}+${pkg.buildNumber}`;
const urlPrefix = "app:///";
const buildDir = resolve(desktopRoot, ".vite/build");
const rendererDir = resolve(desktopRoot, ".vite/renderer/main_window");

function sentry(args) {
  execFileSync("pnpm", ["exec", "sentry-cli", ...args], {
    cwd: desktopRoot,
    stdio: "inherit",
    env: process.env,
  });
}

sentry(["releases", "new", release]);
sentry([
  "releases",
  "files",
  release,
  "upload-sourcemaps",
  "--url-prefix",
  urlPrefix,
  "--ext",
  "js",
  "--ext",
  "map",
  buildDir,
]);
sentry([
  "releases",
  "files",
  release,
  "upload-sourcemaps",
  "--url-prefix",
  urlPrefix,
  "--ext",
  "js",
  "--ext",
  "map",
  rendererDir,
]);
sentry(["releases", "finalize", release]);

console.log(`Uploaded sourcemaps for release ${release}`);
