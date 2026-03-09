import { describe, expect, it } from "vitest";
import {
  GitHubProvider,
  getProvider,
  LinearProvider,
  SentryProvider,
  VercelProvider,
} from "./index.js";

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
    expect(() => getProvider("unknown")).toThrow("Unknown provider: unknown");
  });
});
