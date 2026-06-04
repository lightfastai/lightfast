import { describe, expect, it, vi } from "vitest";

type HealthCallback = (input: {
  step: ReturnType<typeof createStep>;
}) => Promise<unknown>;

let healthCallback: HealthCallback | undefined;

const createFunctionMock = vi.fn(
  (config: { id: string }, handler: HealthCallback): { id: string } => {
    healthCallback = handler;
    return { id: config.id };
  }
);

vi.mock("../env", () => ({
  env: {
    VERCEL_ENV: "development",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { systemHealth } = await import("../inngest/workflow/system-health");

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
  };
}

function runWorkflow(step: ReturnType<typeof createStep>) {
  if (!healthCallback) {
    throw new Error("health callback was not registered");
  }

  return healthCallback({ step });
}

describe("systemHealth", () => {
  it("registers the platform health function", () => {
    expect(systemHealth).toEqual({ id: "system-health" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "system-health",
        idempotency: "event.id",
        retries: 2,
        timeouts: { finish: "30s", start: "30s" },
        triggers: { cron: "*/30 * * * *" },
      },
      expect.any(Function)
    );
  });

  it("returns platform health metadata", async () => {
    const step = createStep();
    const result = await runWorkflow(step);

    expect(result).toMatchObject({
      app: "lightfast-platform",
      environment: "development",
      status: "ok",
    });
    expect((result as { timestamp: string }).timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );
    expect(step.run).toHaveBeenCalledWith(
      "collect platform health",
      expect.any(Function)
    );
  });
});
