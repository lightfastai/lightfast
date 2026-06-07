import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();
const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const scopeSetContextMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@sentry/core", () => ({
  getActiveSpan: () => ({
    spanContext: () => ({ traceId: "trace_1" }),
  }),
  SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN: "sentry.origin",
  SEMANTIC_ATTRIBUTE_SENTRY_SOURCE: "sentry.source",
  startSpan: async (_options: unknown, callback: () => Promise<unknown>) =>
    callback(),
  withIsolationScope: async (
    callback: (scope: {
      setContext: ReturnType<typeof vi.fn>;
      setExtra: ReturnType<typeof vi.fn>;
      setTag: ReturnType<typeof vi.fn>;
    }) => Promise<unknown>
  ) =>
    callback({
      setContext: scopeSetContextMock,
      setExtra: vi.fn(),
      setTag: vi.fn(),
    }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

vi.mock("@vendor/lib", () => ({
  nanoid: () => "request_1",
}));

vi.mock("./log/next", () => ({
  log: {
    debug: vi.fn(),
    error: logErrorMock,
    info: logInfoMock,
    warn: vi.fn(),
  },
}));

const { createObservabilityMiddleware } = await import("./trpc");

describe("createObservabilityMiddleware", () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
    logErrorMock.mockClear();
    logInfoMock.mockClear();
    scopeSetContextMock.mockClear();
  });

  it("omits the cause message from server error logs", async () => {
    const cause = new Error("Your database has been temporarily rate-limited");
    cause.name = "UpstashError";
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      cause,
    });
    const middleware = createObservabilityMiddleware({
      extractAuth: () => ({ userId: "user_1" }),
      isDev: false,
    });

    await middleware({
      ctx: {},
      getRawInput: async () => ({ orgSlug: "acme" }),
      next: async () => ({ error, ok: false }),
      path: "org.setup.github.start",
      type: "mutation",
    });

    const [, meta] = logErrorMock.mock.calls[0] ?? [];
    expect(meta).not.toHaveProperty("causeMessage");
    expect(logErrorMock).toHaveBeenCalledWith(
      "[trpc] server error",
      expect.objectContaining({
        causeName: "UpstashError",
        errorCode: "INTERNAL_SERVER_ERROR",
        errorMessage: "Internal server error",
        path: "org.setup.github.start",
        requestId: "request_1",
        traceId: "trace_1",
        type: "mutation",
        userId: "user_1",
      })
    );
    expect(captureExceptionMock).toHaveBeenCalledWith(
      cause,
      expect.any(Object)
    );
    expect(captureExceptionMock.mock.invocationCallOrder[0]).toBeLessThan(
      logErrorMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it("captures client tRPC errors for short-term visibility", async () => {
    const error = new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported connector provider: x",
    });
    const middleware = createObservabilityMiddleware({
      extractAuth: () => ({ orgId: "org_1", userId: "user_1" }),
      isDev: false,
    });

    await middleware({
      ctx: {},
      getRawInput: async () => ({ provider: "x" }),
      next: async () => ({ error, ok: false }),
      path: "org.workspace.connectors.setAgentEnabled",
      type: "mutation",
    });

    expect(captureExceptionMock).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({
          httpStatus: 400,
          requestId: "request_1",
        }),
        tags: expect.objectContaining({
          "trpc.error_code": "BAD_REQUEST",
          "trpc.http_status": "400",
          "trpc.path": "org.workspace.connectors.setAgentEnabled",
          "trpc.type": "mutation",
        }),
      })
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "[trpc] client error",
      expect.objectContaining({
        errorCode: "BAD_REQUEST",
        errorMessage: "Unsupported connector provider: x",
        path: "org.workspace.connectors.setAgentEnabled",
      })
    );
  });

  it("does not attach raw tRPC input to the Sentry scope", async () => {
    const error = new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid input",
    });
    const middleware = createObservabilityMiddleware({
      extractAuth: () => ({}),
      isDev: false,
    });

    await middleware({
      ctx: {},
      getRawInput: async () => ({
        nested: { token: "secret" },
        provider: "x",
      }),
      next: async () => ({ error, ok: false }),
      path: "org.workspace.connectors.setAgentEnabled",
      type: "mutation",
    });

    expect(scopeSetContextMock).toHaveBeenCalledWith("trpc", {
      procedure_path: "org.workspace.connectors.setAgentEnabled",
      procedure_type: "mutation",
    });
  });
});
