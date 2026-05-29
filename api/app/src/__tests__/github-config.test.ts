import { describe, expect, it } from "vitest";
import {
  normalizeGitHubPrivateKey,
  parseGitHubInstallOverride,
  resolveGitHubAppOrigin,
} from "../github/config";

describe("GitHub config", () => {
  it("normalizes escaped private key newlines", () => {
    expect(normalizeGitHubPrivateKey("a\\nb\\n")).toBe("a\nb\n");
  });

  it("parses the local dev install override context", () => {
    const override = parseGitHubInstallOverride({
      appOrigin: "https://app.lightfast.localhost",
      rawUrl:
        "https://app.lightfast.localhost/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
      vercelEnv: "development",
    });

    expect(override).toMatchObject({
      emulatorOrigin: "http://127.0.0.1:4567",
      installationId: "1001",
      providerAccountLogin: "lightfast-emulated",
      url: expect.stringContaining("/api/dev/github/install"),
    });
  });

  it("resolves the canonical app origin from an install override before appUrl", () => {
    expect(
      resolveGitHubAppOrigin({
        appUrl: "https://app.lightfast.localhost",
        installUrlOverride:
          "https://lightfast.localhost/api/dev/github/install?installation_id=1001",
      })
    ).toBe("https://lightfast.localhost");
  });

  it("falls back to the canonical appUrl when no install override is present", () => {
    expect(
      resolveGitHubAppOrigin({
        appUrl: "https://app.lightfast.localhost",
        installUrlOverride: undefined,
      })
    ).toBe("https://app.lightfast.localhost");
  });

  it("rejects the install override in production", () => {
    expect(() =>
      parseGitHubInstallOverride({
        appOrigin: "https://app.lightfast.ai",
        rawUrl:
          "https://app.lightfast.ai/api/dev/github/install?emulator_origin=http%3A%2F%2F127.0.0.1%3A4567&installation_id=1001&provider_account_login=lightfast-emulated",
        vercelEnv: "production",
      })
    ).toThrow(/not allowed in production/);
  });
});
