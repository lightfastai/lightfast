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

// Don't use `match.url` from `gh release view`: the Finalize job runs this
// step while the release is still a draft, and GitHub reports draft asset
// URLs under a temporary `untagged-<hash>/` path that 404s after the
// `Publish release (undraft)` step rebinds the release to its tag. Build
// the URL deterministically from the tag instead. Slashes inside the tag
// (e.g. `@lightfast/desktop@0.1.0`) are preserved literally — GitHub only
// percent-encodes per path segment.
const encodedTag = TAG.split("/").map(encodeURIComponent).join("/");

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
  const downloadUrl = `https://github.com/${REPO}/releases/download/${encodedTag}/${encodeURIComponent(match.name)}`;
  const feed = {
    url: downloadUrl,
    name: VERSION,
    notes: NOTES,
    pub_date: new Date().toISOString(),
  };
  const file = join(outDir, `latest-mac-${arch}.json`);
  writeFileSync(file, JSON.stringify(feed, null, 2), "utf8");
  outputs.push(file);
  console.log(`wrote ${file} -> ${downloadUrl}`);
}

gh(["release", "upload", TAG, "--repo", REPO, "--clobber", ...outputs], {
  inherit: true,
});
