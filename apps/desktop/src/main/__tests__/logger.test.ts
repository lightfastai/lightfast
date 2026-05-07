import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let isPackagedFlag = false;
let mockedLogsDir = "";
const willQuitListeners: Array<() => void> = [];

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return isPackagedFlag;
    },
    getPath: (name: string) => {
      if (name === "logs") {
        return mockedLogsDir;
      }
      throw new Error(`unexpected getPath(${name})`);
    },
    on: (event: string, listener: () => void) => {
      if (event === "will-quit") {
        willQuitListeners.push(listener);
      }
    },
  },
}));

function listLogFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  };
  try {
    walk(root);
  } catch {
    // dir doesn't exist yet
  }
  return out;
}

function singleLogFile(root: string): string {
  const files = listLogFiles(root);
  expect(files).toHaveLength(1);
  const [file] = files;
  if (!file) {
    throw new Error("expected exactly one log file");
  }
  return file;
}

async function loadLoggerFresh() {
  vi.resetModules();
  return import("../logger");
}

beforeEach(() => {
  mockedLogsDir = mkdtempSync(join(tmpdir(), "desktop-logger-"));
  isPackagedFlag = false;
  willQuitListeners.length = 0;
});

afterEach(() => {
  // close any fds left open by emitting will-quit
  for (const listener of willQuitListeners) {
    listener();
  }
  rmSync(mockedLogsDir, { recursive: true, force: true });
});

describe("logger", () => {
  it("initLogger() opens exactly one file under logs/YYYY/MM/DD/", async () => {
    const { initLogger } = await loadLoggerFresh();
    initLogger();
    const file = singleLogFile(mockedLogsDir);
    const rel = file.slice(mockedLogsDir.length + 1);
    expect(rel).toMatch(/^\d{4}\/\d{2}\/\d{2}\/desktop-\d+-\d{9}\.log$/);
  });

  it("initLogger() is idempotent: second call is a no-op", async () => {
    const { initLogger } = await loadLoggerFresh();
    initLogger();
    const firstFiles = listLogFiles(mockedLogsDir);
    initLogger();
    const secondFiles = listLogFiles(mockedLogsDir);
    expect(secondFiles).toEqual(firstFiles);
    expect(secondFiles).toHaveLength(1);
  });

  it("minLevel is debug in dev (app.isPackaged === false)", async () => {
    isPackagedFlag = false;
    const { initLogger, logger } = await loadLoggerFresh();
    initLogger();
    logger.debug("dev-debug-line");
    const contents = readFileSync(singleLogFile(mockedLogsDir), "utf8");
    expect(contents).toContain("dev-debug-line");
  });

  it("minLevel is info in packaged builds; debug is dropped, error is written", async () => {
    isPackagedFlag = true;
    const { initLogger, logger } = await loadLoggerFresh();
    initLogger();
    logger.debug("should-be-dropped");
    logger.error("should-be-written");
    const contents = readFileSync(singleLogFile(mockedLogsDir), "utf8");
    expect(contents).not.toContain("should-be-dropped");
    expect(contents).toContain("should-be-written");
  });

  it("emits valid JSON lines with ts, level, pid, message", async () => {
    isPackagedFlag = true;
    const { initLogger, logger } = await loadLoggerFresh();
    initLogger();
    logger.info("hello", { count: 3 });
    const lines = readFileSync(singleLogFile(mockedLogsDir), "utf8")
      .split("\n")
      .filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const [first] = lines;
    if (!first) {
      throw new Error("expected one line");
    }
    const parsed = JSON.parse(first) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.pid).toBe(process.pid);
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts as string).toString()).not.toBe("Invalid Date");
    expect(parsed.message).toBe('hello {"count":3}');
  });

  it("serializes Error arguments as name: message\\nstack", async () => {
    isPackagedFlag = true;
    const { initLogger, logger } = await loadLoggerFresh();
    initLogger();
    const err = new Error("boom");
    logger.error("call failed", err);
    const line = readFileSync(singleLogFile(mockedLogsDir), "utf8").trim();
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const msg = parsed.message as string;
    expect(msg).toContain("Error: boom");
    expect(msg).toContain("call failed");
    expect(msg).not.toContain("[object Object]");
  });

  it("file is non-empty after a single emit", async () => {
    isPackagedFlag = true;
    const { initLogger, logger } = await loadLoggerFresh();
    initLogger();
    logger.error("anything");
    expect(statSync(singleLogFile(mockedLogsDir)).size).toBeGreaterThan(0);
  });
});
