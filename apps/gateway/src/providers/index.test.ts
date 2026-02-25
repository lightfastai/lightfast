import { describe, it, expect } from "vitest";
import { getProvider, GitHubProvider, VercelProvider, LinearProvider, SentryProvider } from "./index";

describe("getProvider", () => {
  it("returns GitHubProvider for 'github'", () => {
    expect(getProvider("github")).toBeInstanceOf(GitHubProvider);
  });

  it("returns VercelProvider for 'vercel'", () => {
    expect(getProvider("vercel")).toBeInstanceOf(VercelProvider);
  });

  it("returns LinearProvider for 'linear'", () => {
    expect(getProvider("linear")).toBeInstanceOf(LinearProvider);
  });

  it("returns SentryProvider for 'sentry'", () => {
    expect(getProvider("sentry")).toBeInstanceOf(SentryProvider);
  });

  it("throws for unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow();
  });
});
