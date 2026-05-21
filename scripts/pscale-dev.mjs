import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveDevProjectIdentity,
  sanitizeWorktreePrefix,
} from "@lightfastai/dev-core";

const DEFAULT_DATABASE_NAME = "lightfast";
const DEFAULT_BASE_BRANCH = "main";

export function resolveDevPscaleIdentity({
  cwd = process.cwd(),
  configPath,
  env = process.env,
} = {}) {
  const identity = resolveDevProjectIdentity({ cwd, configPath });
  const databaseName =
    cleanEnvValue(env.PLANETSCALE_DATABASE_NAME) ?? DEFAULT_DATABASE_NAME;
  const orgName = cleanEnvValue(env.PLANETSCALE_ORG_NAME);
  const baseBranch =
    cleanEnvValue(env.PSCALE_BASE_BRANCH_NAME) ?? DEFAULT_BASE_BRANCH;
  const branchName =
    cleanEnvValue(env.PSCALE_BRANCH_NAME) ?? defaultBranchName(identity);

  return {
    baseBranch,
    branchName,
    cachePath: pscaleCachePath(identity.root, databaseName, branchName),
    databaseName,
    orgName,
    root: identity.root,
    rootHash: identity.rootHash,
    worktreePrefix: identity.worktreePrefix,
  };
}

export function resolveDevPscaleConfig(options = {}) {
  const identity = resolveDevPscaleIdentity(options);
  if (!fs.existsSync(identity.cachePath)) {
    throw new Error(
      `No cached PlanetScale credentials found for ${identity.databaseName}/${identity.branchName}. Run pnpm db:up first.`
    );
  }

  const fileEnv = readEnvFile(identity.cachePath);
  const host = requiredValue(fileEnv.DATABASE_HOST, "DATABASE_HOST");
  const username = requiredValue(
    fileEnv.DATABASE_USERNAME,
    "DATABASE_USERNAME"
  );
  const password = requiredValue(
    fileEnv.DATABASE_PASSWORD,
    "DATABASE_PASSWORD"
  );
  const databaseName =
    cleanEnvValue(fileEnv.DATABASE_NAME) ?? identity.databaseName;

  return {
    ...identity,
    databaseName,
    host,
    password,
    source: identity.cachePath,
    username,
  };
}

export async function ensureDevPscaleBranch(options = {}) {
  const identity = resolveDevPscaleIdentity(options);
  ensurePscaleCli();
  await ensurePscaleBranch(identity);

  if (!fs.existsSync(identity.cachePath)) {
    const password = createPscalePassword(identity);
    writeCredentialCache(identity, password);
  }

  return resolveDevPscaleConfig(options);
}

export async function deleteDevPscaleBranch(options = {}) {
  const identity = resolveDevPscaleIdentity(options);
  if (identity.branchName === identity.baseBranch || identity.branchName === "main") {
    throw new Error(`Refusing to delete PlanetScale branch "${identity.branchName}".`);
  }

  ensurePscaleCli();
  const cached = fs.existsSync(identity.cachePath)
    ? readEnvFile(identity.cachePath)
    : {};
  const passwordId = cleanEnvValue(cached.PSCALE_PASSWORD_ID);
  if (passwordId) {
    runPscale([
      "password",
      "delete",
      identity.databaseName,
      identity.branchName,
      passwordId,
      "--force",
      ...orgArgs(identity),
    ]);
  }

  const show = runPscale(
    [
      "branch",
      "show",
      identity.databaseName,
      identity.branchName,
      ...orgArgs(identity),
    ],
    { allowFailure: true }
  );
  if (show.status === 0) {
    runPscale([
      "branch",
      "delete",
      identity.databaseName,
      identity.branchName,
      "--force",
      ...orgArgs(identity),
    ]);
  }

  fs.rmSync(identity.cachePath, { force: true });
  return identity;
}

export function readDevPscaleCache(options = {}) {
  const identity = resolveDevPscaleIdentity(options);
  if (!fs.existsSync(identity.cachePath)) {
    return { ...identity, cached: false };
  }

  const fileEnv = readEnvFile(identity.cachePath);
  return {
    ...identity,
    cached: true,
    databaseName: cleanEnvValue(fileEnv.DATABASE_NAME) ?? identity.databaseName,
    host: cleanEnvValue(fileEnv.DATABASE_HOST),
    source: identity.cachePath,
    username: cleanEnvValue(fileEnv.DATABASE_USERNAME),
  };
}

export function redactPscaleConfig(config) {
  return {
    baseBranch: config.baseBranch,
    branchName: config.branchName,
    cached: config.cached ?? true,
    cachePath: config.cachePath,
    databaseName: config.databaseName,
    host: config.host,
    orgName: config.orgName,
    source: config.source,
    username: config.username,
    worktreePrefix: config.worktreePrefix,
  };
}

function defaultBranchName(identity) {
  const prefix = identity.worktreePrefix
    ? sanitizeWorktreePrefix(identity.worktreePrefix)
    : "local";
  return sanitizePscaleBranchName(`wt-${prefix}-${identity.rootHash}`);
}

function sanitizePscaleBranchName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

function pscaleCachePath(root, databaseName, branchName) {
  return path.join(
    root,
    ".lightfast",
    "pscale",
    sanitizePathSegment(databaseName),
    `${sanitizePathSegment(branchName)}.env`
  );
}

function sanitizePathSegment(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-");
}

async function ensurePscaleBranch(identity) {
  const show = runPscale(
    [
      "branch",
      "show",
      identity.databaseName,
      identity.branchName,
      "-f",
      "json",
      ...orgArgs(identity),
    ],
    { allowFailure: true }
  );
  if (show.status === 0) {
    return;
  }
  const showOutput = `${show.stderr ?? ""}\n${show.stdout ?? ""}`;
  if (/database .*does not exist/i.test(showOutput)) {
    throw new Error(
      `PlanetScale database "${identity.databaseName}" was not found${
        identity.orgName ? ` in org "${identity.orgName}"` : ""
      }. Set PLANETSCALE_DATABASE_NAME/PLANETSCALE_ORG_NAME or create the database first.`
    );
  }

  runPscale([
    "branch",
    "create",
    identity.databaseName,
    identity.branchName,
    "--from",
    identity.baseBranch,
    "--wait",
    ...orgArgs(identity),
  ]);
}

function createPscalePassword(identity) {
  const output = runPscale([
    "password",
    "create",
    identity.databaseName,
    identity.branchName,
    credentialName(identity),
    "-f",
    "json",
    ...orgArgs(identity),
  ]);
  const data = JSON.parse(output.stdout);
  return {
    host: requiredValue(data.access_host_url ?? data.host, "access_host_url"),
    id: cleanEnvValue(data.id),
    password: requiredValue(data.plain_text ?? data.password, "plain_text"),
    username: requiredValue(data.username ?? data.user, "username"),
  };
}

function writeCredentialCache(identity, password) {
  fs.mkdirSync(path.dirname(identity.cachePath), { recursive: true });
  fs.writeFileSync(
    identity.cachePath,
    [
      `DATABASE_HOST=${quoteEnv(password.host)}`,
      `DATABASE_USERNAME=${quoteEnv(password.username)}`,
      `DATABASE_PASSWORD=${quoteEnv(password.password)}`,
      `DATABASE_NAME=${quoteEnv(identity.databaseName)}`,
      `PSCALE_BRANCH_NAME=${quoteEnv(identity.branchName)}`,
      `PLANETSCALE_DATABASE_NAME=${quoteEnv(identity.databaseName)}`,
      identity.orgName
        ? `PLANETSCALE_ORG_NAME=${quoteEnv(identity.orgName)}`
        : undefined,
      password.id ? `PSCALE_PASSWORD_ID=${quoteEnv(password.id)}` : undefined,
      "",
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
    { mode: 0o600 }
  );
}

function credentialName(identity) {
  return `lightfast-${os.userInfo().username}-${identity.rootHash}`;
}

function orgArgs(identity) {
  return identity.orgName ? ["--org", identity.orgName] : [];
}

function runPscale(args, options = {}) {
  const result = spawnSync("pscale", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  if (result.status === 0 || options.allowFailure) {
    return result;
  }

  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  throw new Error(
    [
      `pscale ${args.join(" ")} failed with exit code ${result.status ?? 1}.`,
      stderr,
      stdout,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function ensurePscaleCli() {
  const result = spawnSync("pscale", ["version"], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      "pscale is required for local database branches. Install it and run pscale auth login."
    );
  }
}

function readEnvFile(filePath) {
  const env = {};
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equals = trimmed.indexOf("=");
    if (equals === -1) {
      continue;
    }
    const key = trimmed.slice(0, equals);
    env[key] = unquoteEnv(trimmed.slice(equals + 1));
  }
  return env;
}

function cleanEnvValue(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function requiredValue(value, name) {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) {
    throw new Error(`${name} is required.`);
  }
  return cleaned;
}

function quoteEnv(value) {
  return JSON.stringify(value);
}

function unquoteEnv(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}
