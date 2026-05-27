#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteDevPscaleBranch,
  ensureDevPscaleBranch,
  readDevPscaleCache,
  redactPscaleConfig,
  resolveDevPscaleConfig,
} from "./pscale-dev.mjs";
import { resolveLocalDevProjectIdentity } from "./dev-identity.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const args = process.argv.slice(2);
const command = args.shift();

try {
  switch (command) {
    case "setup":
      await handleSetup(args);
      break;
    case "doctor":
      await handleDoctor(args);
      break;
    case "pscale":
      await handlePscale(args);
      break;
    case "redis":
      await handleRedis(args);
      break;
    case "-h":
    case "--help":
    case undefined:
      printHelp();
      process.exit(command ? 0 : 1);
      break;
    default:
      throw new Error(`Unknown dev service command "${command}".`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function handleSetup(args) {
  const options = parseOptions(args);
  const services = await import("@lightfastai/dev-services");
  const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
  const redis = resolveRedisConfig(services, options);
  await services.ensureRedisServices(redis);
  const pscale = await ensureDevPscaleBranch({
    cwd: repoRoot,
    identity,
    env: localServiceResolverEnv(),
  });

  const report = {
    status: "ok",
    pscale: redactPscaleConfig(pscale),
    redis: {
      restUrl: services.redactRedisRestUrl(redis.restUrl),
      redisUrl: redis.redisUrl,
      keyPrefix: redis.keyPrefix,
    },
  };
  printReport(services, undefined, report, options.json);
}

async function handleDoctor(args) {
  const options = parseOptions(args);
  const services = await import("@lightfastai/dev-services");
  const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
  const checks = [];

  const pscale = readDevPscaleCache({
    cwd: repoRoot,
    identity,
    env: localServiceResolverEnv(),
  });
  checks.push({
    name: "PlanetScale branch credentials",
    status: pscale.cached ? "ok" : "fail",
    ...redactPscaleConfig(pscale),
    message: pscale.cached ? undefined : "Run pnpm db:up.",
  });

  try {
    const redis = resolveRedisConfig(services, options);
    const pong = await services.pingRedisRest(redis);
    checks.push({
      name: "Redis REST",
      status: "ok",
      keyPrefix: redis.keyPrefix,
      pong,
      restUrl: services.redactRedisRestUrl(redis.restUrl),
    });
  } catch (error) {
    checks.push({
      name: "Redis REST",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const report = {
    status: checks.every((check) => check.status === "ok") ? "ok" : "fail",
    checks,
  };
  printReport(services, undefined, report, options.json);
  process.exit(report.status === "fail" ? 1 : 0);
}

async function handlePscale(args) {
  const subcommand = args.shift();

  switch (subcommand) {
    case "env": {
      const options = parseOptions(args);
      const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
      const config = resolveDevPscaleConfig({
        cwd: repoRoot,
        identity,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(config)));
        return;
      }

      console.log(`DATABASE_HOST=${shellQuote(config.host)}`);
      console.log(`DATABASE_USERNAME=${shellQuote(config.username)}`);
      console.log(`DATABASE_PASSWORD=${shellQuote(config.password)}`);
      return;
    }
    case "up": {
      const options = parseOptions(args);
      const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
      const config = await ensureDevPscaleBranch({
        cwd: repoRoot,
        identity,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(config)));
        return;
      }

      console.log(
        `PlanetScale branch ${config.databaseName}/${config.branchName} is ready.`
      );
      return;
    }
    case "down": {
      const options = parseOptions(args);
      const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
      const deletedIdentity = await deleteDevPscaleBranch({
        cwd: repoRoot,
        identity,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(deletedIdentity)));
        return;
      }

      console.log(
        `Deleted PlanetScale branch ${deletedIdentity.databaseName}/${deletedIdentity.branchName}.`
      );
      return;
    }
    case "status": {
      const options = parseOptions(args);
      const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
      const config = readDevPscaleCache({
        cwd: repoRoot,
        identity,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(config)));
        return;
      }

      console.log(
        `${config.databaseName}/${config.branchName}: ${
          config.cached ? `cached at ${config.cachePath}` : "not cached"
        }`
      );
      return;
    }
    case "-h":
    case "--help":
    case undefined:
      printHelp();
      process.exit(subcommand ? 0 : 1);
      break;
    default:
      throw new Error(`Unknown pscale command "${subcommand}".`);
  }
}

async function handleRedis(args) {
  const subcommand = args.shift();
  const services = await import("@lightfastai/dev-services");

  switch (subcommand) {
    case "url": {
      const options = parseOptions(args);
      const config = resolveRedisConfig(services, options);
      if (options.json) {
        console.log(
          JSON.stringify({
            restUrl: config.restUrl,
            redactedRestUrl: services.redactRedisRestUrl(config.restUrl),
            redisUrl: config.redisUrl,
            keyPrefix: config.keyPrefix,
            source: config.source,
            host: config.host,
            redisPort: config.redisPort,
            restPort: config.restPort,
            redisContainerName: config.redisContainerName,
            httpContainerName: config.httpContainerName,
          })
        );
      } else {
        console.log(config.restUrl);
      }
      return;
    }
    case "up":
      if (typeof services.ensureRedisServices !== "function") {
        runLegacyDevServicesCli(["redis-up", ...withDefaultConfig(args)]);
        return;
      }
      await handleRedisUp(services, args);
      return;
    case "ping":
      if (
        typeof services.ensureRedisServices !== "function" ||
        typeof services.pingRedisRest !== "function"
      ) {
        runLegacyDevServicesCli(["redis-ping", ...withDefaultConfig(args)]);
        return;
      }
      await handleRedisPing(services, args);
      return;
    case "-h":
    case "--help":
    case undefined:
      printHelp();
      process.exit(subcommand ? 0 : 1);
      break;
    default:
      throw new Error(`Unknown redis command "${subcommand}".`);
  }
}

async function handleRedisUp(services, args) {
  const options = parseOptions(args);
  const config = resolveRedisConfig(services, options);
  await services.ensureRedisServices(config);

  if (options.json) {
    console.log(
      JSON.stringify({
        restUrl: config.restUrl,
        redactedRestUrl: services.redactRedisRestUrl(config.restUrl),
        redisUrl: config.redisUrl,
        keyPrefix: config.keyPrefix,
        source: config.source,
        networkName: config.networkName,
        redisContainerName: config.redisContainerName,
        httpContainerName: config.httpContainerName,
      })
    );
    return;
  }

  console.log(
    `Redis REST is running at ${config.restUrl} (${config.httpContainerName})`
  );
}

async function handleRedisPing(services, args) {
  const options = parseOptions(args);
  const config = resolveRedisConfig(services, options);
  await services.ensureRedisServices(config);
  const pong = await services.pingRedisRest(config);

  if (options.json) {
    console.log(
      JSON.stringify({
        restUrl: config.restUrl,
        redactedRestUrl: services.redactRedisRestUrl(config.restUrl),
        keyPrefix: config.keyPrefix,
        pong,
      })
    );
    return;
  }

  console.log(pong);
}

function resolveRedisConfig(services, options) {
  const identity = resolveLocalDevProjectIdentity({ root: repoRoot });
  return services.resolveDevRedisConfig({
    cwd: repoRoot,
    identity,
    env: localServiceResolverEnv(),
  });
}

function localServiceResolverEnv() {
  const env = { ...process.env };
  env.DATABASE_HOST = undefined;
  env.DATABASE_USERNAME = undefined;
  env.DATABASE_PASSWORD = undefined;
  env.KV_REST_API_URL = undefined;
  env.KV_REST_API_TOKEN = undefined;
  env.UPSTASH_REDIS_REST_URL = undefined;
  env.UPSTASH_REDIS_REST_TOKEN = undefined;
  return env;
}

function parseOptions(args) {
  const options = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--config":
        readOptionValue(args, ++index, arg);
        break;
      case "--json":
        options.json = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option "${arg}".`);
    }
  }

  return options;
}

function readOptionValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function withDefaultConfig(args) {
  return args;
}

function runLegacyDevServicesCli(args) {
  const packagePath = require.resolve("@lightfastai/dev-services/package.json");
  const packageRoot = path.dirname(packagePath);
  const binPath = path.join(packageRoot, "bin/lightfast-dev-services.mjs");

  if (!fs.existsSync(binPath)) {
    throw new Error(
      "@lightfastai/dev-services does not expose the requested API and no legacy CLI bin is installed."
    );
  }

  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.signal) {
    process.exit(signalExitCode(result.signal));
  }
  process.exit(result.status ?? 1);
}

function printReport(services, printerName, report, json) {
  if (json || typeof services[printerName] !== "function") {
    console.log(JSON.stringify(report, null, json ? 0 : 2));
    return;
  }
  services[printerName](report);
}

function signalExitCode(signal) {
  return 128 + (signal === "SIGINT" ? 2 : 15);
}

function printHelp() {
  console.log(`Usage:
  node scripts/dev-services.mjs setup [--json]
  node scripts/dev-services.mjs doctor [--json]

  node scripts/dev-services.mjs pscale env [--json]
  node scripts/dev-services.mjs pscale up [--json]
  node scripts/dev-services.mjs pscale down [--json]
  node scripts/dev-services.mjs pscale status [--json]

  node scripts/dev-services.mjs redis url [--json]
  node scripts/dev-services.mjs redis up [--json]
  node scripts/dev-services.mjs redis ping [--json]

Options:
  --config <path>        Deprecated; accepted for compatibility and ignored
  --json                 Print JSON output where supported
`);
}
