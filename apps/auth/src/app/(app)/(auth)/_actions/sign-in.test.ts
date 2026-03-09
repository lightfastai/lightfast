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
      "/sign-in?step=code&email=user%40example.com"
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
      "/sign-in?step=code&email=user%2Btest%40example.com"
    );
  });
});
