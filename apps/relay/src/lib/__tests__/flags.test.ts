import { describe, it, expect, beforeEach, vi } from "vitest";

// Reset module state between tests to isolate singleton behavior
vi.mock("@vercel/flags-core", () => ({
  createClient: vi.fn(),
}));

describe("isConsoleFanOutEnabled", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns true when FLAGS env var is not set", async () => {
    vi.stubEnv("FLAGS", undefined as unknown as string);
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled();
    expect(result).toBe(true);
  });

  it("returns true when FLAGS is empty string", async () => {
    vi.stubEnv("FLAGS", "");
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled();
    expect(result).toBe(true);
  });

  it("returns true when FLAGS is not set, even with provider context", async () => {
    vi.stubEnv("FLAGS", undefined as unknown as string);
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled("github");
    expect(result).toBe(true);
  });

  it("calls evaluate with provider context when provider is passed and client exists", async () => {
    const mockEvaluate = vi.fn().mockResolvedValue({ value: false });
    const mockInitialize = vi.fn().mockResolvedValue(undefined);
    const { createClient } = await import("@vercel/flags-core");
    vi.mocked(createClient).mockReturnValue({
      evaluate: mockEvaluate,
      initialize: mockInitialize,
    } as unknown as ReturnType<typeof createClient>);

    vi.stubEnv("FLAGS", "vf_test_key");
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled("github");

    expect(result).toBe(false);
    expect(mockEvaluate).toHaveBeenCalledWith("console-fan-out", true, { provider: "github" });
  });

  it("calls evaluate without context when no provider is passed", async () => {
    const mockEvaluate = vi.fn().mockResolvedValue({ value: true });
    const mockInitialize = vi.fn().mockResolvedValue(undefined);
    const { createClient } = await import("@vercel/flags-core");
    vi.mocked(createClient).mockReturnValue({
      evaluate: mockEvaluate,
      initialize: mockInitialize,
    } as unknown as ReturnType<typeof createClient>);

    vi.stubEnv("FLAGS", "vf_test_key");
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled();

    expect(result).toBe(true);
    expect(mockEvaluate).toHaveBeenCalledWith("console-fan-out", true, undefined);
  });

  it("returns true when evaluate returns undefined value", async () => {
    const mockEvaluate = vi.fn().mockResolvedValue({ value: undefined });
    const mockInitialize = vi.fn().mockResolvedValue(undefined);
    const { createClient } = await import("@vercel/flags-core");
    vi.mocked(createClient).mockReturnValue({
      evaluate: mockEvaluate,
      initialize: mockInitialize,
    } as unknown as ReturnType<typeof createClient>);

    vi.stubEnv("FLAGS", "vf_test_key");
    const { isConsoleFanOutEnabled } = await import("../flags.js");
    const result = await isConsoleFanOutEnabled();

    // undefined falls back to true (default)
    expect(result).toBe(true);
  });
});
