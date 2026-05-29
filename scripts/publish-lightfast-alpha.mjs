import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const dryRun = process.env.DRY_RUN === "1";

const packages = [
  { dir: "core/lightfast", name: "lightfast" },
  { dir: "core/mcp", name: "@lightfastai/mcp" },
];

function readPackageJson(dir) {
  return JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function output(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

function isPublished(name, version) {
  const result = output("npm", ["view", `${name}@${version}`, "version"]);
  return result.status === 0 && result.stdout.trim() === version;
}

function hasTag(tag) {
  const existing = output("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  return existing.status === 0;
}

function createTag(tag) {
  if (dryRun) {
    console.log(`[dry-run] git tag ${tag}`);
    return;
  }

  run("git", ["tag", tag]);
}

const packageJsons = packages.map((pkg) => ({
  ...pkg,
  packageJson: readPackageJson(pkg.dir),
}));

const versions = new Set(packageJsons.map((pkg) => pkg.packageJson.version));
if (versions.size !== 1) {
  throw new Error(
    `Expected lightfast and @lightfastai/mcp versions to match, got ${[
      ...versions,
    ].join(", ")}`,
  );
}

const version = packageJsons[0].packageJson.version;
if (!version.includes("-alpha.")) {
  throw new Error(`Expected an alpha prerelease version, got ${version}`);
}

for (const pkg of packageJsons) {
  if (pkg.packageJson.name !== pkg.name) {
    throw new Error(`Expected ${pkg.dir} to be ${pkg.name}`);
  }

  if (pkg.packageJson.publishConfig?.tag !== "alpha") {
    throw new Error(`${pkg.name} must publish with publishConfig.tag=alpha`);
  }
}

let published = 0;

for (const pkg of packageJsons) {
  const { name, version } = pkg.packageJson;
  const tag = `${name}@${version}`;

  if (isPublished(name, version)) {
    console.log(`${tag} is already published`);
    if (!hasTag(tag)) {
      createTag(tag);
      console.log(`New tag:  ${tag}`);
      published += 1;
    }
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] npm publish --tag alpha --access public (${pkg.dir})`);
  } else {
    run("npm", ["publish", "--tag", "alpha", "--access", "public"], {
      cwd: pkg.dir,
    });
  }

  if (!hasTag(tag)) {
    createTag(tag);
  }
  console.log(`New tag:  ${tag}`);
  published += 1;
}

if (published === 0) {
  console.log("No unpublished lightfast alpha packages found.");
}
