import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (before dynamic import) ──────────────────────────────────

const mockRedirect = vi.fn((url: string): never => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

// isRedirectError: detect our mock's REDIRECT throws
vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: (err: unknown) =>
    err instanceof Error && err.message.startsWith("REDIRECT:"),
}));

// next/server: after() runs callback immediately in tests
vi.mock("next/server", () => ({
  after: (fn: () => void) => fn(),
}));

// Arcjet
const mockProtect = vi.fn();
vi.mock("@vendor/security", () => ({
  ARCJET_KEY: "test-key",
  arcjet: () => ({ protect: mockProtect }),
  detectBot: vi.fn(),
  fixedWindow: vi.fn(),
  request: vi.fn(async () => new Request("http://localhost")),
  shield: vi.fn(),
  slidingWindow: vi.fn(),
  validateEmail: vi.fn(),
}));

// Redis
const mockSismember = vi.fn();
const mockSadd = vi.fn();
vi.mock("@vendor/upstash", () => ({
  redis: { sismember: mockSismember, sadd: mockSadd },
}));

// Clerk
const mockWaitlistCreate = vi.fn();
vi.mock("@vendor/clerk/server", () => ({
  clerkClient: async () => ({
    waitlistEntries: { create: mockWaitlistCreate },
  }),
}));

vi.mock("@vendor/clerk", () => ({
  isClerkAPIResponseError: (err: unknown) =>
    err instanceof Error && "errors" in err && "status" in err,
}));

// Sentry
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Env
vi.mock("~/env", () => ({
  env: { NODE_ENV: "test" },
}));

// ── Import after mocks ─────────────────────────────────────────────

const { joinEarlyAccessAction } = await import("./early-access");

// ── Helpers ─────────────────────────────────────────────────────────

function validFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("email", overrides.email ?? "user@example.com");
  fd.set("companySize", overrides.companySize ?? "11-50");
  fd.set("sources", overrides.sources ?? "github,slack");
  return fd;
}

function allowArcjet() {
  mockProtect.mockResolvedValue({
    isDenied: () => false,
  });
}

function denyArcjet(
  reasonType: "isRateLimit" | "isBot" | "isShield" | "isEmail"
) {
  mockProtect.mockResolvedValue({
    isDenied: () => true,
    reason: {
      isRateLimit: () => reasonType === "isRateLimit",
      isBot: () => reasonType === "isBot",
      isShield: () => reasonType === "isShield",
      isEmail: () => reasonType === "isEmail",
    },
  });
}

function clerkAPIError(
  code: string,
  opts: {
    status?: number;
    longMessage?: string;
    meta?: Record<string, unknown>;
  } = {}
) {
  const err = new Error("ClerkAPIError") as Error & {
    errors: { code: string; longMessage?: string; meta?: unknown }[];
    status: number;
  };
  err.errors = [{ code, longMessage: opts.longMessage, meta: opts.meta }];
  err.status = opts.status ?? 422;
  return err;
}

// ── Tests ───────────────────────────────────────────────────────────

describe("joinEarlyAccessAction", () => {
  beforeEach(() => {
    allowArcjet();
    mockSismember.mockResolvedValue(0); // email not in Redis
    mockWaitlistCreate.mockResolvedValue({}); // Clerk success
    mockSadd.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation ──────────────────────────────────────────────────

  it("redirects with emailError on invalid email", async () => {
    const fd = validFormData({ email: "not-an-email" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("emailError=")
    );
  });

  it("redirects with companySizeError on missing companySize", async () => {
    const fd = validFormData({ companySize: "" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("companySizeError=")
    );
  });

  it("redirects with sourcesError on missing sources", async () => {
    const fd = validFormData({ sources: "" });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("sourcesError=")
    );
  });

  it("preserves field values in validation error redirect", async () => {
    const fd = validFormData({
      email: "not-an-email",
      companySize: "11-50",
      sources: "github",
    });
    await expect(joinEarlyAccessAction(fd)).rejects.toThrow("REDIRECT:");
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("email=not-an-email");
    expect(url).toContain("companySize=11-50");
    expect(url).toContain("sources=github");
  });

  // ── Arcjet ──────────────────────────────────────────────────────

  it("redirects with isRateLimit on Arcjet rate limit", async () => {
    denyArcjet("isRateLimit");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("isRateLimit=true");
    expect(url).toContain("error=");
  });

  it("redirects with bot error on Arcjet bot detection", async () => {
    denyArcjet("isBot");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with shield error on Arcjet shield", async () => {
    denyArcjet("isShield");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with email error on Arcjet email validation", async () => {
    denyArcjet("isEmail");
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  // ── Redis ───────────────────────────────────────────────────────

  it("redirects to success on Redis duplicate (already registered)", async () => {
    mockSismember.mockResolvedValue(1); // email exists
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("success=true");
    expect(url).toContain("email=user");
    // Should NOT call Clerk
    expect(mockWaitlistCreate).not.toHaveBeenCalled();
  });

  it("continues to Clerk on Redis error (fallthrough)", async () => {
    mockSismember.mockRejectedValue(new Error("Redis connection error"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    // Should still call Clerk despite Redis failure
    expect(mockWaitlistCreate).toHaveBeenCalled();
    // Should reach success
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("success=true")
    );
  });

  // ── Clerk success ───────────────────────────────────────────────

  it("redirects to success with email on happy path", async () => {
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockWaitlistCreate).toHaveBeenCalledWith({
      emailAddress: "user@example.com",
    });
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("success=true");
    expect(url).toContain("email=user");
  });

  it("calls redis.sadd after Clerk success (via after())", async () => {
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockSadd).toHaveBeenCalledWith(
      "early-access:emails",
      "user@example.com"
    );
  });

  // ── Clerk errors ────────────────────────────────────────────────

  it("redirects to success on Clerk email_address_exists (already registered)", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("email_address_exists")
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("success=true");
    expect(url).toContain("email=user");
  });

  it("redirects with isRateLimit and preserves fields on Clerk 429", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("too_many_requests", { status: 429 })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("isRateLimit=true");
    expect(url).toContain("email=user");
    expect(url).toContain("companySize=");
    expect(url).toContain("sources=");
  });

  it("redirects with lockout message on Clerk user_locked with seconds", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("user_locked", {
        meta: { lockout_expires_in_seconds: 300 },
      })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("5+minutes") // Math.ceil(300/60) = 5
    );
  });

  it("redirects with generic locked on Clerk user_locked without seconds", async () => {
    mockWaitlistCreate.mockRejectedValue(clerkAPIError("user_locked"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  it("redirects with longMessage on other Clerk errors", async () => {
    mockWaitlistCreate.mockRejectedValue(
      clerkAPIError("unknown_code", { longMessage: "Detailed error info" })
    );
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockCaptureException).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("error=")
    );
  });

  // ── Non-Clerk errors ────────────────────────────────────────────

  it("redirects with generic error and preserves fields on non-Clerk errors", async () => {
    mockWaitlistCreate.mockRejectedValue(new Error("Network error"));
    await expect(joinEarlyAccessAction(validFormData())).rejects.toThrow(
      "REDIRECT:"
    );
    expect(mockCaptureException).toHaveBeenCalled();
    const url = mockRedirect.mock.calls[0]?.[0] as string;
    expect(url).toContain("error=");
    expect(url).toContain("email=user");
    expect(url).toContain("companySize=");
    expect(url).toContain("sources=");
  });
});
