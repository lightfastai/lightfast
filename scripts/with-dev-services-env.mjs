#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorktreeRuntimeName } from "@lightfastai/dev-core";
import { resolveDevRedisConfig } from "@lightfastai/dev-services";
import { resolveDevPscaleConfig } from "./pscale-dev.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const configPath = findDefaultConfigPath();
const args = process.argv.slice(2);

if (args[0] === "--") {
  args.shift();
}

const env = buildEnv();

if (args[0] === "--print") {
  printEnv(env);
  process.exit(0);
}

if (!args.length) {
  console.error(
    "Usage: node scripts/with-dev-services-env.mjs -- <command> [...args]"
  );
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  }
  process.exit(code ?? 0);
});

function buildEnv() {
  if (isDisabled(process.env.LIGHTFAST_DEV_SERVICES)) {
    return process.env;
  }

  const resolverEnv = localServiceResolverEnv();
  const pscale = resolveDevPscaleConfig({
    cwd: repoRoot,
    configPath,
    env: resolverEnv,
  });
  const redis = resolveDevRedisConfig({
    cwd: repoRoot,
    configPath,
    env: resolverEnv,
  });
  const inngestAppName = process.env.INNGEST_APP_NAME
    ? resolveWorktreeRuntimeName(process.env.INNGEST_APP_NAME)
    : undefined;

  return {
    ...process.env,
    DATABASE_HOST: pscale.host,
    DATABASE_USERNAME: pscale.username,
    DATABASE_PASSWORD: pscale.password,
    DATABASE_NAME: pscale.databaseName,
    KV_REST_API_URL: redis.restUrl,
    KV_REST_API_TOKEN: redis.token,
    KV_REST_API_READ_ONLY_TOKEN: redis.token,
    KV_URL: redis.redisUrl,
    REDIS_URL: redis.redisUrl,
    UPSTASH_REDIS_REST_URL: redis.restUrl,
    UPSTASH_REDIS_REST_TOKEN: redis.token,
    LIGHTFAST_DEV_REDIS_KEY_PREFIX: redis.keyPrefix,
    LIGHTFAST_DEV_SERVICES_ACTIVE: "1",
    ...(inngestAppName ? { INNGEST_APP_NAME: inngestAppName } : {}),
  };
}

function localServiceResolverEnv() {
  const env = { ...process.env };
  env.DATABASE_HOST = undefined;
  env.DATABASE_PORT = undefined;
  env.DATABASE_USERNAME = undefined;
  env.DATABASE_PASSWORD = undefined;
  env.DATABASE_NAME = undefined;
  env.KV_REST_API_URL = undefined;
  env.KV_REST_API_TOKEN = undefined;
  env.KV_REST_API_READ_ONLY_TOKEN = undefined;
  env.UPSTASH_REDIS_REST_URL = undefined;
  env.UPSTASH_REDIS_REST_TOKEN = undefined;
  return env;
}

function isDisabled(value) {
  return ["0", "false", "off"].includes(String(value ?? "").toLowerCase());
}

function findDefaultConfigPath() {
  return path.join(repoRoot, "lightfast.dev.json");
}

function printEnv(env) {
  const keys = [
    "DATABASE_HOST",
    "DATABASE_USERNAME",
    "DATABASE_NAME",
    "KV_REST_API_URL",
    "KV_URL",
    "REDIS_URL",
    "INNGEST_APP_NAME",
    "LIGHTFAST_DEV_REDIS_KEY_PREFIX",
    "LIGHTFAST_DEV_SERVICES_ACTIVE",
  ];

  for (const key of keys) {
    if (env[key]) {
      console.log(`${key}=${env[key]}`);
    }
  }
}
