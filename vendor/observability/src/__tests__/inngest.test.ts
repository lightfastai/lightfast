import { beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const flushMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@sentry/core", () => ({
  captureException: captureExceptionMock,
  flush: flushMock,
}));

vi.mock("@vendor/inngest", () => ({
  Middleware: {
    BaseMiddleware: class {},
  },
  NonRetriableError: class NonRetriableError extends Error {},
}));

vi.mock("../log/next", () => ({
  log: {
    error: logErrorMock,
    info: vi.fn(),
  },
}));

const { createInngestObservabilityMiddleware } = await import("../inngest");

describe("createInngestObservabilityMiddleware", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
    flushMock.mockClear();
    logErrorMock.mockClear();
  });

  it("captures retryable run errors through framework-neutral Sentry core", async () => {
    const MiddlewareClass =
      createInngestObservabilityMiddleware() as unknown as new () => {
        onRunError: (args: {
          ctx: unknown;
          error: unknown;
          fn: unknown;
          isFinalAttempt: boolean;
        }) => Promise<void>;
      };
    const middleware = new MiddlewareClass();
    const error = new Error("GitHub installation token response was invalid.");

    await middleware.onRunError({
      ctx: {
        event: {
          data: { correlationId: "corr_1", installationId: "1001" },
          name: "skills/reconcile.requested",
        },
        runId: "run_1",
      },
      error,
      fn: { id: () => "reconcile-skill-indexes" },
      isFinalAttempt: true,
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({
          correlationId: "corr_1",
          isFinalAttempt: true,
        }),
        tags: expect.objectContaining({
          "inngest.event.name": "skills/reconcile.requested",
          "inngest.function.id": "reconcile-skill-indexes",
          "inngest.run.id": "run_1",
        }),
      })
    );
    expect(flushMock).toHaveBeenCalledWith(2000);
    expect(logErrorMock).toHaveBeenCalledWith(
      "[inngest] reconcile-skill-indexes failed",
      expect.objectContaining({
        error: "GitHub installation token response was invalid.",
        isFinalAttempt: true,
      })
    );
  });
});
