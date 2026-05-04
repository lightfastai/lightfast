import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation redirect — it throws in real Next.js
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

// Import after mocks
const { initiateSignIn } = await import("./sign-in");

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
});
