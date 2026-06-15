import { describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://app.lightfast.ai",
    NEXT_PUBLIC_WWW_URL: "https://lightfast.ai",
  },
}));

const { isClerkOAuthContinuationUrl, parseSafeAuthRedirectTarget } =
  await import("../auth-redirect");

describe("auth redirect safety", () => {
  it("allows Clerk production continuation URLs on the app domain", () => {
    const url = new URL("https://clerk.lightfast.ai/oauth-consent");

    expect(isClerkOAuthContinuationUrl(url)).toBe(true);
    expect(parseSafeAuthRedirectTarget(url.toString())).toBe(url.toString());
  });

  it("allows Clerk continuation URLs with query and hash state", () => {
    const url = new URL(
      "https://clerk.lightfast.ai/oauth-consent?redirect_url=%2Fdashboard#step"
    );

    expect(isClerkOAuthContinuationUrl(url)).toBe(true);
    expect(parseSafeAuthRedirectTarget(url.toString())).toBe(url.toString());
  });

  it("allows relative app redirects", () => {
    expect(parseSafeAuthRedirectTarget("/dashboard")).toBe("/dashboard");
  });

  it("rejects non-Clerk absolute redirects", () => {
    expect(
      parseSafeAuthRedirectTarget("https://attacker.example/oauth-consent")
    ).toBeNull();
  });

  it.each([
    "http://clerk.lightfast.ai/oauth-consent",
    "https://evil-clerk.lightfast.ai/oauth-consent",
    "https://nested.clerk.lightfast.ai/oauth-consent",
    "https://clerk.lightfast.ai/oauth-consentish",
    "https://clerk.lightfast.ai/oauth/authorize",
    "//clerk.lightfast.ai/oauth-consent",
    "not-a-url",
    "",
  ])("rejects unsafe redirect target %s", (value) => {
    expect(parseSafeAuthRedirectTarget(value)).toBeNull();
  });

  it("rejects nullish and non-string redirect targets", () => {
    expect(parseSafeAuthRedirectTarget(null)).toBeNull();
    expect(parseSafeAuthRedirectTarget(undefined)).toBeNull();
    expect(parseSafeAuthRedirectTarget(42)).toBeNull();
  });
});
