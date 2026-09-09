import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(repositoryRoot, "skills-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const failures = [];

const expectedSkills = {
  "mcp-builder": {
    canonicalPath: "vendor/mcp/.agents/skills/mcp-builder",
    commit: "41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f",
    repository: "https://github.com/anthropics/skills",
    upstreamSubdirectory: "skills/mcp-builder",
    upstreamTree: "b866bcfb57b780c10b587c7b543e871a91661ce0",
  },
  mysql: {
    canonicalPath: "vendor/db/.agents/skills/mysql",
    commit: "73b20b7eb64716d8c7100c054f0677c0c6e77e30",
    repository: "https://github.com/planetscale/database-skills",
    upstreamSubdirectory: "skills/mysql",
    upstreamTree: "a2d3f6d189cb2847d659da7108b399df9ac08875",
  },
  orpc: {
    canonicalPath: "api/app/.agents/skills/orpc",
    commit: "0cd296a95c33f8871306ab38e16e63a450cca4d1",
    repository: "https://github.com/unnoq/orpc",
    upstreamSubdirectory: "skills/orpc",
    upstreamTree: "47d8f19d0a1147e1b879e4ef719f9c1bca3af65b",
  },
  "orpc-contract": {
    canonicalPath: "packages/api-contract/.agents/skills/orpc-contract",
    commit: "0cd296a95c33f8871306ab38e16e63a450cca4d1",
    repository: "https://github.com/unnoq/orpc",
    upstreamSubdirectory: "skills/orpc-contract",
    upstreamTree: "7e854bb13ecefca583d1cfbe0b0f617adbc3f544",
  },
  "react-email": {
    canonicalPath: "packages/email/.agents/skills/react-email",
    commit: "0f0cb94e1f15581131a2d50b80f8daa13dd1c9fc",
    repository: "https://github.com/resend/react-email",
    upstreamSubdirectory: "skills/react-email",
    upstreamTree: "e6e198406ce5d1b14eb43e7a94f16b8bd2739461",
  },
  turborepo: {
    canonicalPath: ".agents/skills/turborepo",
    commit: "3125eb1a49f0c1b98f460eb3616036ce03837387",
    repository: "https://github.com/vercel/turborepo",
    upstreamSubdirectory: "skills/turborepo",
    upstreamTree: "34eaa69f05167f1e1a809c131547a80b83bf8208",
  },
};

const expectedAliases = {
  "apps/email/.agents/skills/react-email":
    "../../../../packages/email/.agents/skills/react-email",
  "apps/mcp/.agents/skills/mcp-builder":
    "../../../../vendor/mcp/.agents/skills/mcp-builder",
  "core/mcp/.agents/skills/mcp-builder":
    "../../../../vendor/mcp/.agents/skills/mcp-builder",
  "db/app/.agents/skills/mysql":
    "../../../../vendor/db/.agents/skills/mysql",
};

const aliasWorkTriggers = {
  "mcp-builder": "MCP",
  mysql: "MySQL",
  "react-email": "React Email",
};

const expectedLayout = {
  ".agents/skills": ["turborepo"],
  "api/app/.agents/skills": ["orpc"],
  "apps/email/.agents/skills": ["react-email"],
  "apps/mcp/.agents/skills": ["mcp-builder"],
  "core/mcp/.agents/skills": ["mcp-builder"],
  "db/app/.agents/skills": ["mysql"],
  "packages/api-contract/.agents/skills": ["orpc-contract"],
  "packages/email/.agents/skills": ["react-email"],
  "vendor/db/.agents/skills": ["mysql"],
  "vendor/mcp/.agents/skills": ["mcp-builder"],
};

const discoveryCases = {
  ".": ["turborepo"],
  "api/app": ["orpc", "turborepo"],
  "apps/desktop": ["turborepo"],
  "apps/email": ["react-email", "turborepo"],
  "apps/example": ["turborepo"],
  "apps/mcp": ["mcp-builder", "turborepo"],
  "core/cli": ["turborepo"],
  "core/mcp": ["mcp-builder", "turborepo"],
  "db/app": ["mysql", "turborepo"],
  "packages/api-contract": ["orpc-contract", "turborepo"],
  "packages/email": ["react-email", "turborepo"],
  "packages/ui-v2": ["turborepo"],
  "vendor/db": ["mysql", "turborepo"],
  "vendor/mcp": ["mcp-builder", "turborepo"],
};

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".pnpm-store",
  ".react-email",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

function addFailure(message) {
  failures.push(message);
}

function expect(condition, message) {
  if (!condition) {
    addFailure(message);
  }
}

function expectEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    addFailure(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function repositoryPath(absolutePath) {
  return relative(repositoryRoot, absolutePath).split(sep).join("/") || ".";
}

function collectFiles(root, options = {}) {
  const files = [];
  const excludedNames = options.excludedNames ?? new Set();

  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (excludedNames.has(name)) {
        continue;
      }

      const absolutePath = join(directory, name);
      const stat = lstatSync(absolutePath);
      if (stat.isDirectory()) {
        visit(absolutePath);
      } else if (stat.isFile()) {
        files.push(absolutePath);
      } else if (!options.allowSymlinks) {
        throw new Error(`Unsupported entry in canonical tree: ${absolutePath}`);
      }
    }
  }

  visit(root);
  return files;
}

function contentHash(root) {
  const records = collectFiles(root).map((absolutePath) => {
    const stat = lstatSync(absolutePath);
    const mode = stat.mode & 0o111 ? "100755" : "100644";
    const path = relative(root, absolutePath).split(sep).join("/");
    return `${mode} ${path}\0${sha256(readFileSync(absolutePath))}\n`;
  });
  return `sha256:${sha256(records.join(""))}`;
}

function frontmatterName(skillFile) {
  const content = readFileSync(skillFile, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  return frontmatter
    ?.match(/^name:\s*["']?([^"'\r\n]+)["']?\s*$/mu)?.[1]
    ?.trim();
}

function verifyRelativeMarkdownLinks(root) {
  for (const file of collectFiles(root)) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const rawTarget = match[1].trim().split(/\s+/u)[0].replace(/^<|>$/gu, "");
      if (
        !rawTarget ||
        rawTarget.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)
      ) {
        continue;
      }

      const relativeTarget = rawTarget.split(/[?#]/u)[0];
      const resolvedTarget = resolve(dirname(file), relativeTarget);
      const insideRoot =
        resolvedTarget === root || resolvedTarget.startsWith(`${root}${sep}`);
      expect(
        insideRoot && existsSync(resolvedTarget),
        `${repositoryPath(file)} has an unavailable relative link: ${rawTarget}`,
      );
    }
  }
}

function findAgentSkillDirectories() {
  const results = [];

  function visit(directory) {
    const skillsDirectory = join(directory, ".agents", "skills");
    if (existsSync(skillsDirectory)) {
      results.push(repositoryPath(skillsDirectory));
    }

    for (const name of readdirSync(directory).sort()) {
      if (ignoredDirectories.has(name) || name === ".agents") {
        continue;
      }

      const absolutePath = join(directory, name);
      if (lstatSync(absolutePath).isDirectory()) {
        visit(absolutePath);
      }
    }
  }

  visit(repositoryRoot);
  return results.sort();
}

function discoverRepositorySkills(scope) {
  const names = [];
  let directory = resolve(repositoryRoot, scope);

  while (directory === repositoryRoot || directory.startsWith(`${repositoryRoot}${sep}`)) {
    const skillsDirectory = join(directory, ".agents", "skills");
    if (existsSync(skillsDirectory)) {
      for (const entry of readdirSync(skillsDirectory).sort()) {
        const skillFile = join(skillsDirectory, entry, "SKILL.md");
        if (existsSync(skillFile)) {
          names.push(frontmatterName(skillFile));
        } else {
          // Git can materialize a symlink as its target text. Package-local
          // AGENTS.md supplies the same scoped guidance in that checkout mode.
          const aliasPath = join(skillsDirectory, entry);
          const target = expectedAliases[repositoryPath(aliasPath)];
          if (target && lstatSync(aliasPath).isFile() && readFileSync(aliasPath, "utf8") === target) {
            names.push(frontmatterName(join(resolve(skillsDirectory, target), "SKILL.md")));
          }
        }
      }
    }

    if (directory === repositoryRoot) {
      break;
    }
    directory = dirname(directory);
  }

  return names.filter(Boolean).sort();
}

function findForbiddenAgentDirectories() {
  const results = [];

  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (ignoredDirectories.has(name)) {
        continue;
      }

      const absolutePath = join(directory, name);
      const stat = lstatSync(absolutePath);
      if (name === ".claude" || name === ".entire") {
        results.push(repositoryPath(absolutePath));
      } else if (stat.isDirectory()) {
        visit(absolutePath);
      }
    }
  }

  visit(repositoryRoot);
  return results;
}

expectEqual(Object.keys(lock.skills).sort(), Object.keys(expectedSkills).sort(), "skill set");
expect(lock.formatVersion === 1, "skills-lock.json formatVersion must be 1");
const attributes = readFileSync(join(repositoryRoot, ".gitattributes"), "utf8").replaceAll("\r\n", "\n");
for (const rule of [".agents/skills/** -text", "**/.agents/skills/** -text", "provenance/licenses/** -text", "apps/example/AGENTS.md -text"]) {
  expect(attributes.split("\n").includes(rule), `Missing byte-preserving Git attribute: ${rule}`);
}

for (const [name, expectedPin] of Object.entries(expectedSkills)) {
  const entry = lock.skills[name];
  if (!entry) {
    continue;
  }

  for (const [field, expectedValue] of Object.entries(expectedPin)) {
    expect(entry[field] === expectedValue, `${name}.${field} does not match the approved pin`);
  }

  const canonicalPath = join(repositoryRoot, entry.canonicalPath);
  expect(
    existsSync(canonicalPath) &&
      lstatSync(canonicalPath).isDirectory() &&
      !lstatSync(canonicalPath).isSymbolicLink(),
    `${entry.canonicalPath} must be a canonical directory`,
  );
  if (!existsSync(canonicalPath)) {
    continue;
  }

  expect(
    contentHash(canonicalPath) === entry.contentHash,
    `${entry.canonicalPath} differs from its byte-identity hash`,
  );
  expect(
    frontmatterName(join(canonicalPath, "SKILL.md")) === name,
    `${entry.canonicalPath}/SKILL.md has the wrong skill name`,
  );
  verifyRelativeMarkdownLinks(canonicalPath);

  const licensePath = join(repositoryRoot, entry.license.copyPath);
  expect(existsSync(licensePath), `${entry.license.copyPath} is missing`);
  if (existsSync(licensePath)) {
    expect(
      sha256(readFileSync(licensePath)) === entry.license.sha256,
      `${entry.license.copyPath} differs from its licensed upstream bytes`,
    );
  }

  for (const alias of entry.aliases) {
    const aliasPath = join(repositoryRoot, alias.path);
    const isSymlink = existsSync(aliasPath) && lstatSync(aliasPath).isSymbolicLink();
    const isPortableAlias = existsSync(aliasPath) && lstatSync(aliasPath).isFile();
    expect(
      isSymlink || isPortableAlias,
      `${alias.path} must be a symlink or Git's exact symlink target file`,
    );
    if (isSymlink || isPortableAlias) {
      const target = isSymlink ? readlinkSync(aliasPath) : readFileSync(aliasPath, "utf8");
      expect(target === alias.target, `${alias.path} has the wrong relative target`);
      expect(
        realpathSync(resolve(dirname(aliasPath), alias.target)) === realpathSync(canonicalPath),
        `${alias.path} does not resolve to ${entry.canonicalPath}`,
      );
    }

    const packagePath = dirname(dirname(dirname(aliasPath)));
    const fallbackPath = join(packagePath, "AGENTS.md");
    const canonicalLink = relative(packagePath, join(canonicalPath, "SKILL.md")).split(sep).join("/");
    const expectedFallback = `${aliasWorkTriggers[name]} work: if \`.agents/skills/${name}\` is a regular file, read [the canonical skill](${canonicalLink}) before editing. This is the fallback for Git checkouts without symlink support.\n`;
    expect(
      existsSync(fallbackPath) && readFileSync(fallbackPath, "utf8").replaceAll("\r\n", "\n") === expectedFallback,
      `${repositoryPath(fallbackPath)} must provide the scoped portable alias fallback`,
    );
  }
}

const aliasesFromLock = Object.fromEntries(
  Object.values(lock.skills).flatMap((entry) =>
    entry.aliases.map((alias) => [alias.path, alias.target]),
  ),
);
expectEqual(
  Object.fromEntries(Object.entries(aliasesFromLock).sort()),
  expectedAliases,
  "skill aliases",
);
expectEqual(findAgentSkillDirectories(), Object.keys(expectedLayout).sort(), ".agents/skills locations");

for (const [directory, expectedEntries] of Object.entries(expectedLayout)) {
  const actualEntries = readdirSync(join(repositoryRoot, directory)).sort();
  expectEqual(actualEntries, expectedEntries, `${directory} entries`);
}

for (const [scope, expectedNames] of Object.entries(discoveryCases)) {
  expectEqual(discoverRepositorySkills(scope), expectedNames, `${scope} discovery`);
}

const intent = lock.runtimeGuidance.tanstackIntent;
const reactStart = lock.runtimeGuidance.reactStart;
expect(intent.repository === "https://github.com/TanStack/intent", "TanStack Intent repository pin changed");
expect(intent.commit === "206e987a253aee4a26825e419eeda27d53832e49", "TanStack Intent commit pin changed");
expect(intent.upstreamTree === "5f3a5fd1281806677b4790ad66709ea84a39a685", "TanStack Intent tree pin changed");
expect(intent.executableVersion === "0.3.8", "TanStack Intent executable version changed");
expect(intent.command === "pnpm dlx @tanstack/intent@0.3.8 load @tanstack/react-start#react-start", "TanStack Intent command changed");
expect(reactStart.repository === "https://github.com/TanStack/router", "React Start repository pin changed");
expect(reactStart.commit === "650acb4a894f7bf36bd3591de65d10bca9594254", "React Start commit pin changed");
expect(reactStart.upstreamTree === "cce8714768b4deaad9557c74da33e65284149cee", "React Start tree pin changed");

for (const runtimeEntry of [intent, reactStart]) {
  const licensePath = join(repositoryRoot, runtimeEntry.license.copyPath);
  expect(existsSync(licensePath), `${runtimeEntry.license.copyPath} is missing`);
  if (existsSync(licensePath)) {
    expect(
      sha256(readFileSync(licensePath)) === runtimeEntry.license.sha256,
      `${runtimeEntry.license.copyPath} differs from its licensed upstream bytes`,
    );
  }
}

const expectedPointer = `TanStack Start work: run \`${intent.command}\` from this package and follow its installed, version-matched guidance before editing.\n`;
const pointerPath = join(repositoryRoot, intent.pointerPath);
expect(readFileSync(pointerPath, "utf8") === expectedPointer, "TanStack Intent pointer changed");
expect(sha256(readFileSync(pointerPath)) === intent.pointerSha256, "TanStack Intent pointer hash changed");
expect(!existsSync(join(repositoryRoot, "apps/example/.agents")), "apps/example must not copy TanStack skills");
expect(!existsSync(join(repositoryRoot, "apps/example/skills")), "apps/example must not contain a copied skills tree");

const examplePackage = JSON.parse(
  readFileSync(join(repositoryRoot, "apps/example/package.json"), "utf8"),
);
expect(examplePackage.dependencies["@tanstack/react-start"] === "catalog:", "React Start must remain catalog-coupled");
expect(examplePackage.dependencies["@tanstack/react-router"] === "catalog:", "React Router must remain catalog-coupled");

const startPackagePath = join(repositoryRoot, "apps/example/node_modules/@tanstack/react-start/package.json");
const routerPackagePath = join(repositoryRoot, "apps/example/node_modules/@tanstack/react-router/package.json");
expect(existsSync(startPackagePath), "Install dependencies before verifying React Start guidance");
expect(existsSync(routerPackagePath), "Install dependencies before verifying React Router guidance");
if (existsSync(startPackagePath) && existsSync(routerPackagePath)) {
  const startPackage = JSON.parse(readFileSync(startPackagePath, "utf8"));
  const routerPackage = JSON.parse(readFileSync(routerPackagePath, "utf8"));
  expect(startPackage.version === reactStart.installedVersion, "installed React Start version changed");
  expect(
    routerPackage.version === reactStart.installedReactRouterVersion,
    "installed React Router version changed",
  );
  expect(startPackage.files.includes("skills"), "React Start must publish its skills directory");
  expect(
    startPackage.files.includes("!skills/_artifacts"),
    "React Start must exclude maintenance artifacts from its published skills",
  );

  const installedSkillsPath = join(repositoryRoot, reactStart.installedPath);
  expect(
    contentHash(installedSkillsPath) === reactStart.publishedContentHash,
    "installed React Start skill bytes changed",
  );
  expect(
    !existsSync(join(installedSkillsPath, "_artifacts")),
    "React Start maintenance artifacts must not be copied into the installed guidance",
  );
}

const repositoryPackageFiles = collectFiles(repositoryRoot, {
  allowSymlinks: true,
  excludedNames: new Set([...ignoredDirectories, ".agents"]),
}).filter((path) => path.endsWith(`${sep}package.json`) || path === join(repositoryRoot, "package.json"));

for (const packageFile of repositoryPackageFiles) {
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  for (const dependencyGroup of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    expect(
      !Object.hasOwn(packageJson[dependencyGroup] ?? {}, "@tanstack/intent"),
      `${repositoryPath(packageFile)} must not depend on @tanstack/intent`,
    );
  }
}

expect(
  !readFileSync(join(repositoryRoot, "pnpm-lock.yaml"), "utf8").includes("@tanstack/intent"),
  "pnpm-lock.yaml must not contain @tanstack/intent",
);

const apiContractPackage = JSON.parse(
  readFileSync(join(repositoryRoot, "packages/api-contract/package.json"), "utf8"),
);
const apiContractDependencies = Object.keys({
  ...(apiContractPackage.dependencies ?? {}),
  ...(apiContractPackage.devDependencies ?? {}),
  ...(apiContractPackage.optionalDependencies ?? {}),
  ...(apiContractPackage.peerDependencies ?? {}),
});
expect(
  apiContractDependencies.every((dependency) => !dependency.startsWith("@orpc/")),
  "packages/api-contract must remain free of oRPC dependencies",
);

const apiContractSourceFiles = collectFiles(join(repositoryRoot, "packages/api-contract"), {
  excludedNames: new Set([".agents", "__tests__", ...ignoredDirectories]),
});
expect(
  apiContractSourceFiles.every(
    (file) => !readFileSync(file, "utf8").includes("@orpc/"),
  ),
  "packages/api-contract runtime and tests must remain transport-agnostic",
);

expectEqual(findForbiddenAgentDirectories(), [], "retired agent-tooling directories");
expect(lock.omissions.remotion.commit === "54e9b19a612897171e0b3b242e01c2badba4a272", "Remotion omission pin changed");
expect(
  Object.keys(lock.skills).every((name) => !name.toLowerCase().includes("remotion")),
  "Remotion must remain omitted from the installed skill set",
);

const rootPackage = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));
expect(
  rootPackage.scripts["verify:skills"] === "node scripts/verify-agent-skills.mjs",
  "verify:skills must run the deterministic repository check",
);
expect(
  rootPackage.scripts.check.includes("pnpm verify:skills"),
  "pnpm check must include skill verification",
);

if (failures.length > 0) {
  console.error("Agent skill verification failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${Object.keys(lock.skills).length} pinned official skills, ${Object.keys(discoveryCases).length} scoped discovery cases, licenses, aliases, and TanStack runtime guidance.`,
  );
}
