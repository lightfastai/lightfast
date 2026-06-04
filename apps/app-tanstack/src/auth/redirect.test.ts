import { describe, expect, it } from "vitest";
import {
  isClerkOAuthContinuationUrl,
  parseSafeAuthRedirectTarget,
} from "./redirect";

describe("parseSafeAuthRedirectTarget", () => {
  it("accepts local app paths", () => {
    expect(parseSafeAuthRedirectTarget("/")).toBe("/");
    expect(parseSafeAuthRedirectTarget("/agents?tab=active#top")).toBe(
      "/agents?tab=active#top"
    );
  });

  it("accepts Clerk OAuth continuation URLs", () => {
    const consentUrl = new URL(
      "https://charmed-shark-52.accounts.dev/oauth-consent?client_id=cli"
    );
    const immediateRedirectUrl = new URL(
      "https://charmed-shark-52.clerk.accounts.dev/oauth/authorize-with-immediate-redirect?client_id=cli"
    );

    expect(isClerkOAuthContinuationUrl(consentUrl)).toBe(true);
    expect(parseSafeAuthRedirectTarget(consentUrl.toString())).toBe(
      consentUrl.toString()
    );
    expect(isClerkOAuthContinuationUrl(immediateRedirectUrl)).toBe(true);
    expect(parseSafeAuthRedirectTarget(immediateRedirectUrl.toString())).toBe(
      immediateRedirectUrl.toString()
    );
  });

  it("rejects absent, null-like, external, and malformed redirect targets", () => {
    expect(parseSafeAuthRedirectTarget(undefined)).toBeNull();
    expect(parseSafeAuthRedirectTarget(null)).toBeNull();
    expect(parseSafeAuthRedirectTarget("")).toBeNull();
    expect(parseSafeAuthRedirectTarget("null")).toBeNull();
    expect(parseSafeAuthRedirectTarget("https://evil.example")).toBeNull();
    expect(
      parseSafeAuthRedirectTarget("http://charmed-shark-52.accounts.dev")
    ).toBeNull();
    expect(
      parseSafeAuthRedirectTarget(
        "https://charmed-shark-52.accounts.dev/oauth/authorize"
      )
    ).toBeNull();
    expect(parseSafeAuthRedirectTarget("//evil.example/path")).toBeNull();
    expect(parseSafeAuthRedirectTarget("javascript:alert(1)")).toBeNull();
    expect(parseSafeAuthRedirectTarget("/%E0%A4%A")).toBeNull();
  });
});
