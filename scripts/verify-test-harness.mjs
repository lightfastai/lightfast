import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (args, cwd = root) =>
  execFileSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SKIP_ENV_VALIDATION: "true" },
    stdio: ["ignore", "pipe", "inherit"],
  });
// Deliberate package-level coverage commitments, not a frozen file/count list.
// Add a package here when it acquires its first maintained test suite.
const expectedPackages = [
  "@api/app",
  "@db/app",
  "@lightfast/desktop",
  "@lightfast/example",
  "@lightfast/mcp-local",
  "@lightfast/remotion",
  "@lightfastai/cli",
  "@lightfastai/mcp",
  "@repo/api-contract",
  "lightfast",
];
const { tasks } = JSON.parse(run(["turbo", "run", "test", "--dry=json"]));
const suites = tasks.filter(
  (task) => task.task === "test" && task.command !== "<NONEXISTENT>"
);
for (const name of expectedPackages) {
  assert.ok(suites.some((task) => task.package === name), `${name}: missing test task`);
}
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" }
).split("\0");
const tests = [...new Set(files.filter((file) => existsSync(path.join(root, file)) && /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)))];
const covered = new Set();
for (const task of suites) {
  const cwd = path.join(root, task.directory);
  const expected = tests.filter((file) => file.startsWith(`${task.directory}/`));
  assert.ok(expected.length > 0, `${task.package}: no test files`);
  const listed = task.package === "@lightfast/remotion"
    ? JSON.parse(run(["exec", "tsx", "src/run-tests.ts", "--list"], cwd))
    : JSON.parse(run(["exec", "vitest", "list", "--filesOnly", "--json"], cwd)).map((entry) => entry.file);
  const discovered = listed.map((file) => path.relative(root, file).split(path.sep).join("/")).sort();
  assert.deepEqual(discovered, expected.sort(), `${task.package}: runner discovery mismatch`);
  for (const file of expected) {
    assert.ok(path.relative(cwd, path.join(root, file)) in task.inputs, `${file}: absent from Turbo cache inputs`);
    covered.add(file);
  }
  console.log(`${task.package}: ${discovered.length} test files discovered and cached`);
}
assert.deepEqual([...covered].sort(), tests.sort(), "Test files exist outside runnable package suites");
