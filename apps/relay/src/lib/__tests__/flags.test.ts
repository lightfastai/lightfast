import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@vendor/vercel-flags", () => ({
  evaluateFlag: vi.fn(),
}));

describe("isConsoleFanOutEnabled", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls evaluateFlag with console-fan-out key and default true", async () => {
    const { evaluateFlag } = await import("@vendor/vercel-flags");
    vi.mocked(evaluateFlag).mockResolvedValue(true);

    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled();

    expect(result).toBe(true);
    expect(evaluateFlag).toHaveBeenCalledWith("console-fan-out", true, undefined);
  });

  it("passes webhook.provider context when provider is given", async () => {
    const { evaluateFlag } = await import("@vendor/vercel-flags");
    vi.mocked(evaluateFlag).mockResolvedValue(false);

    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled("github");

    expect(result).toBe(false);
    expect(evaluateFlag).toHaveBeenCalledWith("console-fan-out", true, {
      webhook: { provider: "github" },
    });
  });

  it("returns true when evaluateFlag returns true", async () => {
    const { evaluateFlag } = await import("@vendor/vercel-flags");
    vi.mocked(evaluateFlag).mockResolvedValue(true);

    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled("linear");

    expect(result).toBe(true);
  });

  it("returns false when evaluateFlag returns false", async () => {
    const { evaluateFlag } = await import("@vendor/vercel-flags");
    vi.mocked(evaluateFlag).mockResolvedValue(false);

    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled("sentry");

    expect(result).toBe(false);
  });

  it("propagates error when evaluateFlag rejects", async () => {
    const { evaluateFlag } = await import("@vendor/vercel-flags");
    vi.mocked(evaluateFlag).mockRejectedValue(new Error("SDK initialization failed"));

    const { isConsoleFanOutEnabled } = await import("../flags.js");
    await expect(isConsoleFanOutEnabled()).rejects.toThrow("SDK initialization failed");
  });
});
