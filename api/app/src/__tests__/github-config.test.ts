import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GITHUB_APP_ENDPOINTS,
  getGitHubAppConfig,
  normalizeGitHubPrivateKey,
  resolveGitHubAppEndpoints,
  resolveGitHubAppOrigin,
} from "../github/config";

describe("GitHub config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes escaped private key newlines", () => {
    expect(normalizeGitHubPrivateKey("a\\nb\\n")).toBe("a\nb\n");
  });

  it("resolves the app origin from NEXT_PUBLIC_APP_URL", () => {
    expect(
      resolveGitHubAppOrigin({
        appUrl: "https://app.lightfast.localhost",
      })
    ).toBe("https://app.lightfast.localhost");
  });

  it("defaults to real GitHub endpoints", () => {
    expect(
      resolveGitHubAppEndpoints({
        endpointOrigin: undefined,
        legacyInstallUrlOverride: undefined,
      })
    ).toEqual(DEFAULT_GITHUB_APP_ENDPOINTS);
  });

  it("resolves a local combined endpoint origin", () => {
    expect(
      resolveGitHubAppEndpoints({
        endpointOrigin: "https://github.lightfast.localhost",
        legacyInstallUrlOverride: undefined,
        vercelEnv: "development",
      })
    ).toEqual({
      apiBaseUrl: "https://github.lightfast.localhost",
      oauthAuthorizeUrl:
        "https://github.lightfast.localhost/login/oauth/authorize",
      oauthTokenUrl:
        "https://github.lightfast.localhost/login/oauth/access_token",
      webBaseUrl: "https://github.lightfast.localhost",
    });
  });

  it.each(["preview", "production"] as const)(
    "rejects custom endpoint origins in %s",
    (vercelEnv) => {
      expect(() =>
        resolveGitHubAppEndpoints({
          endpointOrigin: "https://github.lightfast.localhost",
          legacyInstallUrlOverride: undefined,
          vercelEnv,
        })
      ).toThrow(/custom GitHub endpoints are allowed only in local development/);
    }
  );

  it("rejects legacy install overrides even in development", () => {
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );

    expect(() =>
      resolveGitHubAppEndpoints({
        endpointOrigin: undefined,
        vercelEnv: "development",
      })
    ).toThrow(/GITHUB_INSTALL_URL_OVERRIDE is no longer supported/);
  });

  it("rejects ambient legacy install override for default config", async () => {
    vi.stubEnv("GITHUB_API_VERSION", "2022-11-28");
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "github_client_test");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "github_secret_test");
    vi.stubEnv(
      "GITHUB_APP_ENDPOINT_ORIGIN",
      "https://github.lightfast.localhost"
    );
    vi.stubEnv("GITHUB_APP_ID", "12345");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "line1\\nline2");
    vi.stubEnv("GITHUB_APP_SLUG", "lightfast-test");
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );
    vi.stubEnv("VERCEL_ENV", "development");
    vi.resetModules();

    const { getGitHubAppConfig: getRuntimeGitHubAppConfig } = await import(
      "../github/config"
    );

    expect(() => getRuntimeGitHubAppConfig()).toThrow(
      /GITHUB_INSTALL_URL_OVERRIDE is no longer supported/
    );
  });

  it("uses explicit config env instead of ambient legacy install override", () => {
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );

    const config = getGitHubAppConfig({
      env: {
        GITHUB_API_VERSION: "2022-11-28",
        GITHUB_APP_CLIENT_ID: "github_client_test",
        GITHUB_APP_CLIENT_SECRET: "github_secret_test",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
        GITHUB_APP_SLUG: "lightfast-test",
        GITHUB_INSTALL_URL_OVERRIDE: undefined,
        VERCEL_ENV: "development",
      },
    });

    expect(config.endpoints.apiBaseUrl).toBe(
      "https://github.lightfast.localhost"
    );
  });

  it.each(["preview", "production"] as const)(
    "getGitHubAppConfig rejects custom endpoint origins in %s",
    (vercelEnv) => {
      expect(() =>
        getGitHubAppConfig({
          env: {
            GITHUB_API_VERSION: "2022-11-28",
            GITHUB_APP_CLIENT_ID: "github_client_test",
            GITHUB_APP_CLIENT_SECRET: "github_secret_test",
            GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
            GITHUB_APP_ID: "12345",
            GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
            GITHUB_APP_SLUG: "lightfast-test",
            VERCEL_ENV: vercelEnv,
          },
        })
      ).toThrow(/custom GitHub endpoints are allowed only in local development/);
    }
  );

  it("returns complete GitHub App config when required values are present", () => {
    const config = getGitHubAppConfig({
      env: {
        GITHUB_API_VERSION: "2022-11-28",
        GITHUB_APP_CLIENT_ID: "github_client_test",
        GITHUB_APP_CLIENT_SECRET: "github_secret_test",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
        GITHUB_APP_SLUG: "lightfast-test",
        VERCEL_ENV: "development",
      },
    });

    expect(config).toMatchObject({
      apiVersion: "2022-11-28",
      appId: "12345",
      appSlug: "lightfast-test",
      clientId: "github_client_test",
      clientSecret: "github_secret_test",
      endpoints: {
        apiBaseUrl: "https://github.lightfast.localhost",
      },
      privateKey: "line1\nline2",
    });
  });
});
