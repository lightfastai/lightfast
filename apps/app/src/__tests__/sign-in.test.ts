import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect — it throws in real Next.js
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

// Mock ~/cors so getRedirectUrl can validate absolute URLs without pulling in
// the full origins/env stack at module load (cors.ts has a top-level throw if
// portless isn't running). The allowlist mirrors the canonical app origin in
// dev (portless aggregate) and prod.
vi.mock("~/cors", () => ({
  isAllowedOrigin: (origin: string | null) =>
    origin === "https://lightfast.localhost" ||
    origin === "https://lightfast.ai",
}));

// Import after mocks
const { initiateSignIn } = await import("~/app/(auth)/_actions/sign-in");

describe("initiateSignIn", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to step=code with encoded email on valid input", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user@example.com"
    );
  });

  it("redirects to error on invalid email", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-in?error=")
    );
  });

  it("redirects to error on missing email", async () => {
    const formData = new FormData();

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-in?error=")
    );
  });

  it("encodes special characters in email", async () => {
    const formData = new FormData();
    formData.set("email", "user+test@example.com");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user%2Btest@example.com"
    );
  });

  it("preserves redirect_url for desktop auth handoff", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set(
      "redirect_url",
      "https://lightfast.localhost/desktop/auth?state=abc&callback=http%3A%2F%2F127.0.0.1%3A1234%2Fcallback"
    );

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user@example.com&redirect_url=https://lightfast.localhost/desktop/auth?state=abc%26callback=http%253A%252F%252F127.0.0.1%253A1234%252Fcallback"
    );
  });

  it("strips redirect_url pointing at an off-allowlist origin", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("redirect_url", "https://evil.example.com/steal");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user@example.com"
    );
  });

  it("strips redirect_url with protocol-relative // prefix", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("redirect_url", "//evil.example.com/steal");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-in?step=code&email=user@example.com"
    );
  });

  it("preserves redirect_url through the validation-failure branch", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("redirect_url", "/account/welcome");

    await expect(initiateSignIn(formData)).rejects.toThrow("REDIRECT:");
    const calledWith = mockRedirect.mock.calls[0]?.[0] as string;
    expect(calledWith).toMatch(/^\/sign-in\?/);
    expect(calledWith).toContain("error=");
    expect(calledWith).toContain("redirect_url=/account/welcome");
  });
});
