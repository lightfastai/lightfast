import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const source = import.meta.dirname;
const files = readdirSync(source, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(test|spec)\.tsx?$/.test(file))
  .sort()
  .map((file) => path.join(source, file));
assert.ok(files.length > 0, "No Remotion tests discovered");
if (process.argv.includes("--list")) {
  console.log(JSON.stringify(files));
} else {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", "--test-concurrency=1", ...files],
    { stdio: "inherit" }
  );
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}
