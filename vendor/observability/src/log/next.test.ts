import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryDebugMock = vi.fn();
const sentryErrorMock = vi.fn();
const sentryInfoMock = vi.fn();
const sentryWarnMock = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@sentry/nextjs", () => ({
  logger: {
    debug: sentryDebugMock,
    error: sentryErrorMock,
    info: sentryInfoMock,
    warn: sentryWarnMock,
  },
}));

vi.mock("../context", () => ({
  getContext: () => ({ requestId: "request_1" }),
}));

const { log } = await import("./next");

describe("log/next", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sentryDebugMock.mockReset();
    sentryErrorMock.mockReset();
    sentryInfoMock.mockReset();
    sentryWarnMock.mockReset();
  });

  it("writes Vercel console logs and Sentry logs", () => {
    const consoleInfoMock = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    log.info("[test] completed", {
      count: 2,
      nested: { ok: true },
      userId: "user_1",
    });

    expect(consoleInfoMock).toHaveBeenCalledWith("[test] completed", {
      count: 2,
      nested: { ok: true },
      requestId: "request_1",
      userId: "user_1",
    });
    expect(sentryInfoMock).toHaveBeenCalledWith("[test] completed", {
      count: 2,
      nested: '{"ok":true}',
      requestId: "request_1",
      userId: "user_1",
    });
  });

  it("does not throw when console or Sentry logging throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("console unavailable");
    });
    sentryWarnMock.mockImplementationOnce(() => {
      throw new Error("sentry unavailable");
    });

    expect(() => log.warn("[test] warning")).not.toThrow();
    expect(sentryWarnMock).toHaveBeenCalledWith("[test] warning", {
      requestId: "request_1",
    });
  });
});
