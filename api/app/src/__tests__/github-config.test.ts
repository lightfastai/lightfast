import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GITHUB_APP_ENDPOINTS,
  type getGitHubAppConfig,
  normalizeGitHubPrivateKey,
  parseGitHubAppConfig,
  resolveGitHubAppEndpoints,
  resolveGitHubAppOrigin,
} from "../services/github/config";

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

  it.each([
    "preview",
    "production",
  ] as const)("rejects custom endpoint origins in %s", (vercelEnv) => {
    expect(() =>
      resolveGitHubAppEndpoints({
        endpointOrigin: "https://github.lightfast.localhost",
        legacyInstallUrlOverride: undefined,
        vercelEnv,
      })
    ).toThrow(/custom GitHub endpoints are allowed only in local development/);
  });

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
      "../services/github/config"
    );

    expect(() => getRuntimeGitHubAppConfig()).toThrow(
      /GITHUB_INSTALL_URL_OVERRIDE is no longer supported/
    );
  });

  it("rejects ambient legacy install override before required app env validation", async () => {
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );
    vi.resetModules();

    const { getGitHubAppConfig: getRuntimeGitHubAppConfig } = await import(
      "../services/github/config"
    );

    expect(() => getRuntimeGitHubAppConfig()).toThrow(
      /GITHUB_INSTALL_URL_OVERRIDE is no longer supported/
    );
  });

  it("rejects incomplete ambient config when env validation is skipped", async () => {
    vi.stubEnv("GITHUB_API_VERSION", "2022-11-28");
    vi.stubEnv("GITHUB_APP_CLIENT_ID", "github_client_test");
    vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "github_secret_test");
    vi.stubEnv("GITHUB_APP_ENDPOINT_ORIGIN", "");
    vi.stubEnv("GITHUB_APP_ID", "12345");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    vi.stubEnv("GITHUB_APP_SLUG", "lightfast-test");
    vi.stubEnv("GITHUB_INSTALL_URL_OVERRIDE", "");
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.resetModules();

    const { getGitHubAppConfig: getRuntimeGitHubAppConfig } = await import(
      "../services/github/config"
    );

    expect(() => getRuntimeGitHubAppConfig()).toThrow(
      "GitHub App environment is incomplete."
    );
  });

  it("keeps getGitHubAppConfig ambient-only at the type interface", () => {
    const runtimeConfigIsAmbientOnly: Parameters<
      typeof getGitHubAppConfig
    > extends []
      ? true
      : never = true;

    expect(runtimeConfigIsAmbientOnly).toBe(true);
  });

  it("uses explicit parsed config env instead of ambient legacy install override", () => {
    vi.stubEnv(
      "GITHUB_INSTALL_URL_OVERRIDE",
      "https://app.lightfast.localhost/api/dev/github/install?installation_id=1001"
    );

    const config = parseGitHubAppConfig({
      GITHUB_API_VERSION: "2022-11-28",
      GITHUB_APP_CLIENT_ID: "github_client_test",
      GITHUB_APP_CLIENT_SECRET: "github_secret_test",
      GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
      GITHUB_APP_SLUG: "lightfast-test",
      GITHUB_INSTALL_URL_OVERRIDE: undefined,
      VERCEL_ENV: "development",
    });

    expect(config.endpoints.apiBaseUrl).toBe(
      "https://github.lightfast.localhost"
    );
  });

  it("uses real GitHub endpoints when explicit config env omits endpoint origin", () => {
    vi.stubEnv(
      "GITHUB_APP_ENDPOINT_ORIGIN",
      "https://github.lightfast.localhost"
    );

    const config = parseGitHubAppConfig({
      GITHUB_API_VERSION: "2022-11-28",
      GITHUB_APP_CLIENT_ID: "github_client_test",
      GITHUB_APP_CLIENT_SECRET: "github_secret_test",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
      GITHUB_APP_SLUG: "lightfast-test",
      VERCEL_ENV: "development",
    });

    expect(config.endpoints).toEqual(DEFAULT_GITHUB_APP_ENDPOINTS);
  });

  it("defaults omitted explicit VERCEL_ENV to development", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    const config = parseGitHubAppConfig({
      GITHUB_API_VERSION: "2022-11-28",
      GITHUB_APP_CLIENT_ID: "github_client_test",
      GITHUB_APP_CLIENT_SECRET: "github_secret_test",
      GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
      GITHUB_APP_SLUG: "lightfast-test",
    });

    expect(config.endpoints.apiBaseUrl).toBe(
      "https://github.lightfast.localhost"
    );
  });

  it("rejects incomplete explicit config env", () => {
    expect(() =>
      parseGitHubAppConfig({
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
        VERCEL_ENV: "development",
      })
    ).toThrow("GitHub App environment is incomplete.");
  });

  it.each([
    "preview",
    "production",
  ] as const)("parseGitHubAppConfig rejects custom endpoint origins in %s", (vercelEnv) => {
    expect(() =>
      parseGitHubAppConfig({
        GITHUB_API_VERSION: "2022-11-28",
        GITHUB_APP_CLIENT_ID: "github_client_test",
        GITHUB_APP_CLIENT_SECRET: "github_secret_test",
        GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
        GITHUB_APP_SLUG: "lightfast-test",
        VERCEL_ENV: vercelEnv,
      })
    ).toThrow(/custom GitHub endpoints are allowed only in local development/);
  });

  it("returns complete GitHub App config when required values are present", () => {
    const config = parseGitHubAppConfig({
      GITHUB_API_VERSION: "2022-11-28",
      GITHUB_APP_CLIENT_ID: "github_client_test",
      GITHUB_APP_CLIENT_SECRET: "github_secret_test",
      GITHUB_APP_ENDPOINT_ORIGIN: "https://github.lightfast.localhost",
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: "line1\\nline2",
      GITHUB_APP_SLUG: "lightfast-test",
      VERCEL_ENV: "development",
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
