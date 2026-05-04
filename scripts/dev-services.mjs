#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    case "postgres":
      await handlePostgres(args);
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
  const services = await import("@lightfastai/dev-services");
  if (typeof services.runDevServicesSetup !== "function") {
    runLegacyDevServicesCli(["setup", ...withDefaultConfig(args)]);
    return;
  }

  const options = parseOptions(args);
  const report = await services.runDevServicesSetup({
    configPath: options.configPath,
    env: localServiceResolverEnv(),
  });
  printReport(services, "printSetupReport", report, options.json);
  process.exit(report.status === "fail" ? 1 : 0);
}

async function handleDoctor(args) {
  const services = await import("@lightfastai/dev-services");
  if (typeof services.runDevServicesDoctor !== "function") {
    runLegacyDevServicesCli(["doctor", ...withDefaultConfig(args)]);
    return;
  }

  const options = parseOptions(args);
  const report = await services.runDevServicesDoctor({
    configPath: options.configPath,
    env: localServiceResolverEnv(),
    postgresTable: options.postgresTable,
  });
  printReport(services, "printDoctorReport", report, options.json);
  process.exit(report.status === "fail" ? 1 : 0);
}

async function handlePostgres(args) {
  const subcommand = args.shift();
  const services = await import("@lightfastai/dev-services");

  switch (subcommand) {
    case "url": {
      const options = parseOptions(args);
      const config = services.resolveDevPostgresConfig({
        cwd: repoRoot,
        configPath: options.configPath,
        env: localServiceResolverEnv(),
      });
      if (options.json) {
        console.log(
          JSON.stringify({
            databaseName: config.databaseName,
            databaseUrl: config.databaseUrl,
            redactedDatabaseUrl: services.redactPostgresUrl(config.databaseUrl),
            source: config.source,
            host: config.host,
            port: config.port,
            containerName: config.containerName,
          })
        );
      } else {
        console.log(config.databaseUrl);
      }
      return;
    }
    case "up":
      if (typeof services.ensurePostgresContainer !== "function") {
        runLegacyDevServicesCli(["postgres-up", ...args]);
        return;
      }
      await handlePostgresUp(services, args);
      return;
    case "create":
      if (
        typeof services.ensurePostgresContainer !== "function" ||
        typeof services.ensurePostgresDatabase !== "function"
      ) {
        runLegacyDevServicesCli([
          "postgres-create",
          ...withDefaultConfig(args),
        ]);
        return;
      }
      await handlePostgresCreate(services, args);
      return;
    case "-h":
    case "--help":
    case undefined:
      printHelp();
      process.exit(subcommand ? 0 : 1);
      break;
    default:
      throw new Error(`Unknown postgres command "${subcommand}".`);
  }
}

async function handlePostgresUp(services, args) {
  const options = parseOptions(args);
  const service = services.resolveDevPostgresServiceConfig(process.env);
  await services.ensurePostgresContainer(service);

  if (options.json) {
    console.log(
      JSON.stringify({
        containerName: service.containerName,
        image: service.image,
        host: service.host,
        port: service.port,
        volumeName: service.volumeName,
      })
    );
    return;
  }

  console.log(
    `Postgres is running at ${service.host}:${service.port} (${service.containerName})`
  );
}

async function handlePostgresCreate(services, args) {
  const options = parseOptions(args);
  const config = services.resolveDevPostgresConfig({
    cwd: repoRoot,
    configPath: options.configPath,
    env: localServiceResolverEnv(),
  });
  await services.ensurePostgresContainer(config);
  const created = await services.ensurePostgresDatabase(config);

  if (options.json) {
    console.log(
      JSON.stringify({
        databaseName: config.databaseName,
        databaseUrl: config.databaseUrl,
        redactedDatabaseUrl: services.redactPostgresUrl(config.databaseUrl),
        created,
      })
    );
    return;
  }

  console.log(
    `${created ? "Created" : "Reused"} dev Postgres database ${config.databaseName}`
  );
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
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    shuttingDown = true;
    syncRuntime.stop();
    if (!child.killed) {
      child.kill(signal);
    }
  };

  for (const signal of signals) {
    process.once(signal, () => shutdown(signal));
  }

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      syncRuntime.stop();
    }
    process.exit(signal ? signalExitCode(signal) : (code ?? 0));
  });
}

async function resolveInngestTargets(services, options) {
  const explicitTargets = services.buildInngestDevSyncTargets({
    result: {
      appUrls: Object.fromEntries(
        options.appUrls.map(({ appName, url }) => [appName, url])
      ),
      localAppNames: options.appUrls.map(({ appName }) => appName),
    },
    servePath: options.servePath,
  });

  if (!options.mfeApps.length) {
    return explicitTargets;
  }

  const relatedProjects = await import("@lightfastai/related-projects");
  const appUrls = Object.fromEntries(
    options.mfeApps.map((appName) => [
      appName,
      relatedProjects.resolvePortlessApplicationUrl({
        app: appName,
        cwd: repoRoot,
        env: process.env,
      }),
    ])
  );

  return [
    ...explicitTargets,
    ...services.buildInngestDevSyncTargets({
      result: {
        appUrls,
        localAppNames: options.mfeApps,
      },
      servePath: options.servePath,
    }),
  ];
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
  env.DATABASE_URL = undefined;
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
    appUrls: [],
    configPath: defaultConfigPath,
    mfeApps: [],
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    switch (arg) {
      case "--app-url":
        options.appUrls.push(parseAppUrl(readOptionValue(args, ++index, arg)));
        break;
      case "--config":
        options.configPath = path.resolve(
          process.cwd(),
          readOptionValue(args, ++index, arg)
        );
        break;
      case "--json":
        options.json = true;
        break;
      case "--mfe-app":
        options.mfeApps.push(readOptionValue(args, ++index, arg));
        break;
      case "--no-inngest-sync":
        options.inngestSync = false;
        break;
      case "--postgres-table":
        options.postgresTable = readOptionValue(args, ++index, arg);
        break;
      case "--serve-path":
        options.servePath = readOptionValue(args, ++index, arg);
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

function parseAppUrl(value) {
  const separatorIndex = value.indexOf("=");
  if (separatorIndex > 0) {
    return {
      appName: value.slice(0, separatorIndex),
      url: value.slice(separatorIndex + 1),
    };
  }

  const hostname = new URL(value).hostname;
  return {
    appName: hostname.split(".")[0] || hostname,
    url: value,
  };
}

function readOptionValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
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
  const devConfig = path.join(repoRoot, "lightfast.dev.json");
  if (fs.existsSync(devConfig)) {
    return devConfig;
  }
  return path.join(repoRoot, "related-projects.json");
}

function signalExitCode(signal) {
  return 128 + (signal === "SIGINT" ? 2 : 15);
}

function printHelp() {
  console.log(`Usage:
  node scripts/dev-services.mjs setup [--json]
  node scripts/dev-services.mjs doctor [--postgres-table <name>] [--json]
  node scripts/dev-services.mjs inngest-sync [--mfe-app <name>] [--app-url <name=url>] -- <command> [...args]

  node scripts/dev-services.mjs postgres url [--json]
  node scripts/dev-services.mjs postgres up [--json]
  node scripts/dev-services.mjs postgres create [--json]

  node scripts/dev-services.mjs redis url [--json]
  node scripts/dev-services.mjs redis up [--json]
  node scripts/dev-services.mjs redis ping [--json]

Options:
  --config <path>       Path to lightfast.dev.json
  --mfe-app <name>      Resolve an MFE app URL for Inngest sync
  --app-url <name=url>  Explicit app URL to sync into the Inngest Dev Server
  --serve-path <path>   Inngest serve route path. Default: /api/inngest
  --no-inngest-sync     Run wrapped command without Inngest endpoint sync
  --json                Print JSON output where supported
`);
}
