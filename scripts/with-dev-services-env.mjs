#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDevPostgresConfig,
  resolveDevRedisConfig,
} from "@lightfastai/dev-services";

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
  const postgres = resolveDevPostgresConfig({
    cwd: repoRoot,
    configPath,
    env: resolverEnv,
  });
  const redis = resolveDevRedisConfig({
    cwd: repoRoot,
    configPath,
    env: resolverEnv,
  });

  return {
    ...process.env,
    DATABASE_HOST: postgres.host,
    DATABASE_PORT: String(postgres.port),
    DATABASE_USERNAME: postgres.username,
    DATABASE_PASSWORD: postgres.password,
    DATABASE_NAME: postgres.databaseName,
    KV_REST_API_URL: redis.restUrl,
    KV_REST_API_TOKEN: redis.token,
    KV_REST_API_READ_ONLY_TOKEN: redis.token,
    KV_URL: redis.redisUrl,
    REDIS_URL: redis.redisUrl,
    UPSTASH_REDIS_REST_URL: redis.restUrl,
    UPSTASH_REDIS_REST_TOKEN: redis.token,
    LIGHTFAST_DEV_REDIS_KEY_PREFIX: redis.keyPrefix,
    LIGHTFAST_DEV_SERVICES_ACTIVE: "1",
  };
}

function localServiceResolverEnv() {
  const env = { ...process.env };
  env.DATABASE_URL = undefined;
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
  const devConfig = path.join(repoRoot, "lightfast.dev.json");
  if (fs.existsSync(devConfig)) {
    return devConfig;
  }
  return path.join(repoRoot, "related-projects.json");
}

function printEnv(env) {
  const keys = [
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_USERNAME",
    "DATABASE_NAME",
    "KV_REST_API_URL",
    "KV_URL",
    "REDIS_URL",
    "LIGHTFAST_DEV_REDIS_KEY_PREFIX",
    "LIGHTFAST_DEV_SERVICES_ACTIVE",
  ];

  for (const key of keys) {
    if (env[key]) {
      console.log(`${key}=${env[key]}`);
    }
  }
}
