#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
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

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const defaultConfigPath = findDefaultConfigPath();
const signals = ["SIGINT", "SIGTERM"];

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
    case "inngest-sync":
      await handleInngestSync(args);
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
  const redis = resolveRedisConfig(services, options);
  await services.ensureRedisServices(redis);
  const pscale = await ensureDevPscaleBranch({
    cwd: repoRoot,
    configPath: options.configPath,
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
  const checks = [];

  const pscale = readDevPscaleCache({
    cwd: repoRoot,
    configPath: options.configPath,
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
      const config = resolveDevPscaleConfig({
        cwd: repoRoot,
        configPath: options.configPath,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(config)));
        return;
      }

      console.log(`DATABASE_HOST=${shellQuote(config.host)}`);
      console.log(`DATABASE_USERNAME=${shellQuote(config.username)}`);
      console.log(`DATABASE_PASSWORD=${shellQuote(config.password)}`);
      console.log(`DATABASE_NAME=${shellQuote(config.databaseName)}`);
      return;
    }
    case "up": {
      const options = parseOptions(args);
      const config = await ensureDevPscaleBranch({
        cwd: repoRoot,
        configPath: options.configPath,
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
      const identity = await deleteDevPscaleBranch({
        cwd: repoRoot,
        configPath: options.configPath,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(JSON.stringify(redactPscaleConfig(identity)));
        return;
      }

      console.log(
        `Deleted PlanetScale branch ${identity.databaseName}/${identity.branchName}.`
      );
      return;
    }
    case "status": {
      const options = parseOptions(args);
      const config = readDevPscaleCache({
        cwd: repoRoot,
        configPath: options.configPath,
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

async function handleInngestSync(args) {
  const { options, commandArgs } = parseCommandArgs(args);
  if (!commandArgs.length) {
    throw new Error(
      "Usage: node scripts/dev-services.mjs inngest-sync [options] -- <command> [...args]"
    );
  }

  const services = await import("@lightfastai/dev-services");
  const enabled =
    options.inngestSync !== false &&
    services.isInngestDevSyncEnabled(process.env);
  const targets = enabled ? await resolveInngestTargets(services, options) : [];
  const syncRuntime = services.startInngestDevSync({
    targets,
    enabled: targets.length > 0,
  });

  const child = spawn(commandArgs[0], commandArgs.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) {
      process.kill(process.pid, signal);
      return;
    }
    shuttingDown = true;
    syncRuntime.stop();
    if (child.pid && !child.killed) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    }
  };

  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      syncRuntime.stop();
    }
    process.exit(signal ? signalExitCode(signal) : (code ?? 0));
  });
}

async function resolveInngestTargets(services, options) {
  if (!options.registerApps.length) {
    return [];
  }

  const proxy = await import("@lightfastai/dev-proxy");
  const appUrls = Object.fromEntries(
    options.registerApps.map((appName) => [
      appName,
      proxy.resolvePortlessAppUrl({
        app: appName,
        cwd: repoRoot,
        env: process.env,
        configPath: options.configPath,
      }),
    ])
  );

  return services.buildInngestDevSyncTargets({
    result: {
      appUrls,
      localAppNames: options.registerApps,
    },
    servePath: options.servePath,
  });
}

function resolveRedisConfig(services, options) {
  return services.resolveDevRedisConfig({
    cwd: repoRoot,
    configPath: options.configPath,
    env: localServiceResolverEnv(),
  });
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
  env.UPSTASH_REDIS_REST_URL = undefined;
  env.UPSTASH_REDIS_REST_TOKEN = undefined;
  return env;
}

function parseCommandArgs(args) {
  const separatorIndex = args.indexOf("--");
  const optionArgs = separatorIndex === -1 ? [] : args.slice(0, separatorIndex);
  const commandArgs =
    separatorIndex === -1 ? args : args.slice(separatorIndex + 1);
  return {
    options: parseOptions(optionArgs),
    commandArgs,
  };
}

function parseOptions(args) {
  const options = {
    configPath: defaultConfigPath,
    registerApps: [],
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--config":
        options.configPath = path.resolve(
          process.cwd(),
          readOptionValue(args, ++index, arg)
        );
        break;
      case "--json":
        options.json = true;
        break;
      case "--no-inngest-sync":
        options.inngestSync = false;
        break;
      case "--force":
        options.force = true;
        break;
      case "--register-app":
        options.registerApps.push(readOptionValue(args, ++index, arg));
        break;
      case "--serve-path":
        options.servePath = readOptionValue(args, ++index, arg);
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      case "--app-url":
      case "--mfe-app":
        throw new Error(
          `${arg} was removed in dev-proxy 0.4.0; use --register-app <name> (the app must be declared in lightfast.dev.json).`
        );
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
  if (args.includes("--config")) {
    return args;
  }
  return ["--config", defaultConfigPath, ...args];
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

function findDefaultConfigPath() {
  return path.join(repoRoot, "lightfast.dev.json");
}

function signalExitCode(signal) {
  return 128 + (signal === "SIGINT" ? 2 : 15);
}

function printHelp() {
  console.log(`Usage:
  node scripts/dev-services.mjs setup [--json]
  node scripts/dev-services.mjs doctor [--json]
  node scripts/dev-services.mjs inngest-sync [--register-app <name>]... -- <command> [...args]

  node scripts/dev-services.mjs pscale env [--json]
  node scripts/dev-services.mjs pscale up [--json]
  node scripts/dev-services.mjs pscale down [--json]
  node scripts/dev-services.mjs pscale status [--json]

  node scripts/dev-services.mjs redis url [--json]
  node scripts/dev-services.mjs redis up [--json]
  node scripts/dev-services.mjs redis ping [--json]

Options:
  --config <path>        Path to lightfast.dev.json
  --register-app <name>  Resolve a registered app's portless URL for Inngest sync (must be declared in lightfast.dev.json)
  --serve-path <path>    Inngest serve route path. Default: /api/inngest
  --no-inngest-sync      Run wrapped command without Inngest endpoint sync
  --json                 Print JSON output where supported
`);
}
