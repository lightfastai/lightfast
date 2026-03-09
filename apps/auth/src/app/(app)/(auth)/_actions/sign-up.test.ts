import { afterEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

const { initiateSignUp } = await import("./sign-up");

describe("initiateSignUp", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to step=code with encoded email on valid input", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user@example.com"
    );
  });

  it("includes ticket param when provided", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("ticket", "inv_abc123");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user@example.com&ticket=inv_abc123"
    );
  });

  it("redirects to error on invalid email", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-up?error=")
    );
  });

  it("preserves ticket in error redirect", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("ticket", "inv_abc123");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringMatching(/\/sign-up\?error=.*&ticket=inv_abc123/)
    );
  });

  it("redirects to error on missing email", async () => {
    const formData = new FormData();

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/sign-up?error=")
    );
  });

  it("omits ticket param when empty string", async () => {
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("ticket", "");

    await expect(initiateSignUp(formData)).rejects.toThrow("REDIRECT:");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/sign-up?step=code&email=user@example.com"
    );
  });
});
