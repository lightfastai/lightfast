import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = { kind: "mock-db" } as unknown as Database;
const cleanupExpiredDeveloperSandboxRunsMock = vi.fn();
const createDeveloperSandboxRunServiceMock = vi.fn(() => ({
  cleanupExpiredDeveloperSandboxRuns: cleanupExpiredDeveloperSandboxRunsMock,
}));

type CleanupCallback = (input: {
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

let cleanupCallback: CleanupCallback | undefined;

const createFunctionMock = vi.fn(
  (config: { id: string }, handler: CleanupCallback): { id: string } => {
    cleanupCallback = handler;
    return { id: config.id };
  }
);

vi.mock("@db/app/client", () => ({ db }));

vi.mock("../services/developer-sandbox-runs", () => ({
  createDeveloperSandboxRunService: createDeveloperSandboxRunServiceMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { cleanupDeveloperSandboxRuns } = await import(
  "../inngest/workflow/cleanup-developer-sandbox-runs"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
  };
}

function runWorkflow(step: ReturnType<typeof createStep>) {
  if (!cleanupCallback) {
    throw new Error("cleanup callback was not registered");
  }

  return cleanupCallback({ step });
}

describe("cleanupDeveloperSandboxRuns", () => {
  beforeEach(() => {
    cleanupExpiredDeveloperSandboxRunsMock.mockReset();
    cleanupExpiredDeveloperSandboxRunsMock.mockResolvedValue({
      cleaned: 1,
      failed: 0,
    });
  });

  it("registers the cleanup function", () => {
    expect(cleanupDeveloperSandboxRuns).toEqual({
      id: "cleanup-developer-sandbox-runs",
    });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "cleanup-developer-sandbox-runs",
        retries: 1,
        timeouts: { finish: "2m", start: "1m" },
        triggers: { cron: "*/5 * * * *" },
      },
      expect.any(Function)
    );
  });

  it("runs sandbox cleanup inside an Inngest step", async () => {
    const step = createStep();

    await expect(runWorkflow(step)).resolves.toEqual({
      cleaned: 1,
      failed: 0,
    });

    expect(createDeveloperSandboxRunServiceMock).toHaveBeenCalledWith({ db });
    expect(cleanupExpiredDeveloperSandboxRunsMock).toHaveBeenCalledWith({
      limit: 25,
    });
    expect(step.run).toHaveBeenCalledWith(
      "cleanup expired developer sandbox runs",
      expect.any(Function)
    );
  });
});
