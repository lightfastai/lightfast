#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = process.env.GH_REPO;
const TAG = process.env.RELEASE_TAG;
const VERSION = process.env.RELEASE_VERSION;
const NOTES = process.env.RELEASE_NOTES ?? "";
const ARCHES = ["arm64", "x64"];

if (!(REPO && TAG && VERSION)) {
  console.error(
    "Missing required env: GH_REPO (owner/name), RELEASE_TAG, RELEASE_VERSION"
  );
  process.exit(1);
}

function gh(args, opts = {}) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
  });
}

const assetsJson = gh([
  "release",
  "view",
  TAG,
  "--repo",
  REPO,
  "--json",
  "assets",
]);
const { assets } = JSON.parse(assetsJson);

const outDir = mkdtempSync(join(tmpdir(), "lightfast-update-feed-"));
const outputs = [];
for (const arch of ARCHES) {
  const match = assets.find(
    (a) => a.name.includes(`darwin-${arch}`) && a.name.endsWith(".zip")
  );
  if (!match) {
    console.error(`No darwin-${arch} zip asset found on release ${TAG}`);
    process.exit(1);
  }
  const feed = {
    url: match.url,
    name: VERSION,
    notes: NOTES,
    pub_date: new Date().toISOString(),
  };
  const file = join(outDir, `latest-mac-${arch}.json`);
  writeFileSync(file, JSON.stringify(feed, null, 2), "utf8");
  outputs.push(file);
  console.log(`wrote ${file} -> ${match.url}`);
}

gh(["release", "upload", TAG, "--repo", REPO, "--clobber", ...outputs], {
  inherit: true,
});
