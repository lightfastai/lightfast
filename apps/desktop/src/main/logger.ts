import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";

type Level = "debug" | "info" | "warn" | "error";
const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// initLogger() must run before any logger.* call. Top-level *imports* of this
// module are safe (no fd is opened until init); what's unsafe is calling
// logger.* at module-init time before initLogger() runs in index.ts.
let fd: number | null = null;
let minLevel: Level = "info";

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

function computeLogPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hms = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  return join(
    app.getPath("logs"),
    yyyy,
    mm,
    dd,
    `desktop-${process.pid}-${hms}.log`
  );
}

function formatArg(a: unknown): string {
  if (typeof a === "string") {
    return a;
  }
  if (a instanceof Error) {
    return `${a.name}: ${a.message}${a.stack ? `\n${a.stack}` : ""}`;
  }
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function emit(level: Level, args: unknown[]): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) {
    return;
  }
  const record = `${JSON.stringify({
    ts: new Date().toISOString(),
    level,
    pid: process.pid,
    message: args.map(formatArg).join(" "),
  })}\n`;
  if (fd !== null) {
    try {
      writeSync(fd, record);
    } catch {
      // Disk full / fd closed during quit. Logging must never crash the app.
    }
  }
  if (!app.isPackaged) {
    const sink =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    sink(...args);
  }
}

export function initLogger(): void {
  if (fd !== null) {
    return;
  }
  const filePath = computeLogPath();
  mkdirSync(dirname(filePath), { recursive: true });
  fd = openSync(filePath, "a");
  minLevel = app.isPackaged ? "info" : "debug";
  app.on("will-quit", () => {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // fd already gone
      }
      fd = null;
    }
  });
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
