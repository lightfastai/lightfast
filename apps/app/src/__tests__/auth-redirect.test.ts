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

  it("rejects non-Clerk absolute redirects", () => {
    expect(
      parseSafeAuthRedirectTarget("https://attacker.example/oauth-consent")
    ).toBeNull();
  });
});
