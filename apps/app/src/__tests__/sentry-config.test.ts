import { TRPCClientError } from "@trpc/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  addIntegration: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
  consoleLoggingIntegration: vi.fn(() => ({ name: "console-logging" })),
  extraErrorDataIntegration: vi.fn(() => ({ name: "extra-error-data" })),
  feedbackIntegration: vi.fn(() => ({ name: "feedback" })),
  httpClientIntegration: vi.fn(() => ({ name: "http-client" })),
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: "replay" })),
}));

vi.mock("@sentry/nextjs", () => ({
  addIntegration: sentryMocks.addIntegration,
  captureRouterTransitionStart: sentryMocks.captureRouterTransitionStart,
  consoleLoggingIntegration: sentryMocks.consoleLoggingIntegration,
  extraErrorDataIntegration: sentryMocks.extraErrorDataIntegration,
  feedbackIntegration: sentryMocks.feedbackIntegration,
  httpClientIntegration: sentryMocks.httpClientIntegration,
  init: sentryMocks.init,
  replayIntegration: sentryMocks.replayIntegration,
}));

vi.mock("@vendor/braintrust/otel", () => ({
  registerBraintrustOTel: vi.fn(),
}));

vi.mock("@vendor/inngest", () => ({
  NonRetriableError: class NonRetriableError extends Error {},
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SENTRY_DSN: "https://public@example.com/1",
    NEXT_PUBLIC_VERCEL_ENV: "production",
    SENTRY_DSN: "https://server@example.com/1",
  },
}));

describe("Sentry config", () => {
  it("keeps low-status tRPC server errors during wide capture mode", async () => {
    vi.resetModules();
    sentryMocks.init.mockClear();

    await import("../sentry.server.config");

    const options = sentryMocks.init.mock.calls[0]?.[0];
    const event = { event_id: "server_event" };
    const error = new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported connector provider: x",
    });

    expect(options?.beforeSend?.(event, { originalException: error })).toBe(
      event
    );
  });

  it("keeps low-status tRPC client errors during wide capture mode", async () => {
    vi.resetModules();
    sentryMocks.init.mockClear();

    await import("../instrumentation-client");

    const options = sentryMocks.init.mock.calls[0]?.[0];
    const event = { event_id: "client_event" };
    const error = new TRPCClientError("Unsupported connector provider: x", {
      result: {
        error: {
          code: -32_600,
          data: {
            code: "BAD_REQUEST",
            httpStatus: 400,
            path: "org.workspace.connectors.setAgentEnabled",
          },
          message: "Unsupported connector provider: x",
        },
      },
    });

    expect(options?.beforeSend?.(event, { originalException: error })).toBe(
      event
    );
  });
});
