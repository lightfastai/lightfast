#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";

const DEFAULT_SERVE_PATH = "/api/inngest";
const DEFAULT_SYNC_INTERVAL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 2_000;
const FALSE_VALUES = new Set(["0", "false", "off"]);
const signals = ["SIGINT", "SIGTERM"];

const { options, commandArgs } = parseArgs(process.argv.slice(2));

if (!commandArgs.length) {
  throw new Error(
    "Usage: node scripts/inngest-portless-sync.mjs --app <portless-name> [--serve-path <path>] -- <command> [...args]"
  );
}

const targets = options.apps.map((appName) => ({
  appName,
  url: new URL(options.servePath, resolvePortlessUrl(appName)).toString(),
}));
const syncRuntime = startSync({
  enabled: isSyncEnabled(process.env),
  targets,
});

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  detached: process.platform !== "win32",
});

let shuttingDown = false;

function shutdown(signal) {
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
}

for (const signal of signals) {
  process.on(signal, () => shutdown(signal));
}

child.on("exit", (code, signal) => {
  if (!shuttingDown) {
    syncRuntime.stop();
  }
  process.exit(signal ? signalExitCode(signal) : (code ?? 0));
});

function parseArgs(args) {
  if (args.includes("-h") || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const separatorIndex = args.indexOf("--");
  const optionArgs = separatorIndex === -1 ? [] : args.slice(0, separatorIndex);
  const commandArgs =
    separatorIndex === -1 ? args : args.slice(separatorIndex + 1);
  const options = {
    apps: [],
    servePath: DEFAULT_SERVE_PATH,
  };

  for (let index = 0; index < optionArgs.length; index++) {
    const arg = optionArgs[index];
    switch (arg) {
      case "--app":
        options.apps.push(readOptionValue(optionArgs, ++index, arg));
        break;
      case "--serve-path":
        options.servePath = readOptionValue(optionArgs, ++index, arg);
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

  if (!options.apps.length) {
    throw new Error("At least one --app value is required.");
  }

  return { commandArgs, options };
}

function readOptionValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function resolvePortlessUrl(appName) {
  return execFileSync("portless", ["get", appName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function isSyncEnabled(env) {
  const value = env.PORTLESS_MFE_INNGEST_SYNC?.toLowerCase();
  return !FALSE_VALUES.has(value ?? "");
}

function startSync({ enabled, targets }) {
  const timers = new Set();
  let stopped = false;

  const runtime = {
    stop() {
      stopped = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    },
  };

  if (!enabled) {
    return runtime;
  }

  const schedule = (target, delayMs) => {
    if (stopped) {
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      void attempt(target);
    }, delayMs);
    timers.add(timer);
  };

  const attempt = async (target) => {
    if (stopped) {
      return;
    }
    const result = await syncTarget(target);
    if (stopped) {
      return;
    }
    if (result.ok) {
      console.log(`Inngest synced ${target.appName}: ${target.url}`);
      return;
    }
    schedule(target, DEFAULT_SYNC_INTERVAL_MS);
  };

  for (const target of targets) {
    schedule(target, 1_000);
  }

  return runtime;
}

async function syncTarget(target) {
  const statusCode = await put(target.url).catch(() => undefined);
  return { ok: Boolean(statusCode && statusCode >= 200 && statusCode < 300) };
}

function put(rawUrl) {
  const url = new URL(rawUrl);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "PUT",
        rejectUnauthorized: !url.hostname.endsWith(".localhost"),
        timeout: DEFAULT_REQUEST_TIMEOUT_MS,
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }
    );

    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out syncing ${rawUrl}`));
    });
    request.end();
  });
}

function signalExitCode(signal) {
  return 128 + (signal === "SIGINT" ? 2 : 15);
}

function printHelp() {
  console.log(`Usage:
  node scripts/inngest-portless-sync.mjs --app <portless-name> [--serve-path <path>] -- <command> [...args]

Options:
  --app <name>         Portless app name to sync, for example app.lightfast.
  --serve-path <path>  Inngest serve route path. Default: /api/inngest
`);
}
