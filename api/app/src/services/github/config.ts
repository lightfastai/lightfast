import { env as runtimeEnv } from "../../env";

export interface GitHubAppEndpoints {
  apiBaseUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
  webBaseUrl: string;
}

export interface GitHubAppConfig {
  apiVersion: string;
  appId: string;
  appSlug: string;
  clientId: string;
  clientSecret: string;
  endpoints: GitHubAppEndpoints;
  privateKey: string;
}

export const DEFAULT_GITHUB_APP_ENDPOINTS: GitHubAppEndpoints = {
  apiBaseUrl: "https://api.github.com",
  oauthAuthorizeUrl: "https://github.com/login/oauth/authorize",
  oauthTokenUrl: "https://github.com/login/oauth/access_token",
  webBaseUrl: "https://github.com",
};

interface GitHubAppConfigEnv {
  GITHUB_API_VERSION?: string;
  GITHUB_APP_CLIENT_ID?: string;
  GITHUB_APP_CLIENT_SECRET?: string;
  GITHUB_APP_ENDPOINT_ORIGIN?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_APP_SLUG?: string;
  GITHUB_INSTALL_URL_OVERRIDE?: string;
  VERCEL_ENV?: "development" | "preview" | "production";
}

interface RequiredGitHubAppConfigValues {
  apiVersion: string;
  appId: string;
  appSlug: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
}

export function normalizeGitHubPrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function resolveGitHubAppOrigin(
  input: { appUrl?: string } = {}
): string {
  const appUrl = input.appUrl ?? process.env.VITE_LIGHTFAST_APP_URL;
  if (!appUrl) {
    throw new Error(
      "VITE_LIGHTFAST_APP_URL is required for GitHub app origin resolution."
    );
  }

  return new URL(appUrl).origin;
}

function assertNoLegacyInstallOverride(input: {
  legacyInstallUrlOverride?: string;
}) {
  if (input.legacyInstallUrlOverride) {
    throw new Error(
      "GITHUB_INSTALL_URL_OVERRIDE is no longer supported. Use GITHUB_APP_ENDPOINT_ORIGIN for local GitHub-compatible endpoints."
    );
  }
}

function resolveOriginUrls(originValue: string): GitHubAppEndpoints {
  const origin = new URL(originValue).origin;
  return {
    apiBaseUrl: origin,
    oauthAuthorizeUrl: new URL("/login/oauth/authorize", origin).toString(),
    oauthTokenUrl: new URL("/login/oauth/access_token", origin).toString(),
    webBaseUrl: origin,
  };
}

export function resolveGitHubAppEndpoints(
  input: {
    endpointOrigin?: string;
    legacyInstallUrlOverride?: string;
    vercelEnv?: "development" | "preview" | "production";
  } = {}
): GitHubAppEndpoints {
  const legacyInstallUrlOverride = Object.hasOwn(
    input,
    "legacyInstallUrlOverride"
  )
    ? input.legacyInstallUrlOverride
    : process.env.GITHUB_INSTALL_URL_OVERRIDE;
  assertNoLegacyInstallOverride({ legacyInstallUrlOverride });

  const endpointOrigin = Object.hasOwn(input, "endpointOrigin")
    ? input.endpointOrigin
    : runtimeEnv.GITHUB_APP_ENDPOINT_ORIGIN;
  if (!endpointOrigin) {
    return DEFAULT_GITHUB_APP_ENDPOINTS;
  }

  const vercelEnv = input.vercelEnv ?? runtimeEnv.VERCEL_ENV;
  if (vercelEnv !== "development") {
    throw new Error(
      "custom GitHub endpoints are allowed only in local development and tests."
    );
  }

  return resolveOriginUrls(endpointOrigin);
}

export function parseGitHubAppConfig(
  configEnv: GitHubAppConfigEnv
): GitHubAppConfig {
  const endpoints = resolveGitHubAppEndpoints({
    endpointOrigin: configEnv.GITHUB_APP_ENDPOINT_ORIGIN,
    legacyInstallUrlOverride: configEnv.GITHUB_INSTALL_URL_OVERRIDE,
    vercelEnv: configEnv.VERCEL_ENV ?? "development",
  });

  const required = parseRequiredGitHubAppConfig(configEnv);

  return {
    apiVersion: required.apiVersion,
    appId: required.appId,
    appSlug: required.appSlug,
    clientId: required.clientId,
    clientSecret: required.clientSecret,
    endpoints,
    privateKey: normalizeGitHubPrivateKey(required.privateKey),
  };
}

export function getGitHubAppConfig(): GitHubAppConfig {
  const endpoints = resolveGitHubAppEndpoints({
    endpointOrigin: runtimeEnv.GITHUB_APP_ENDPOINT_ORIGIN,
    vercelEnv: runtimeEnv.VERCEL_ENV,
  });
  const required = parseRequiredGitHubAppConfig(runtimeEnv);

  return {
    apiVersion: required.apiVersion,
    appId: required.appId,
    appSlug: required.appSlug,
    clientId: required.clientId,
    clientSecret: required.clientSecret,
    endpoints,
    privateKey: normalizeGitHubPrivateKey(required.privateKey),
  };
}

function parseRequiredGitHubAppConfig(
  configEnv: GitHubAppConfigEnv
): RequiredGitHubAppConfigValues {
  const required = {
    apiVersion: configEnv.GITHUB_API_VERSION ?? "2022-11-28",
    appId: configEnv.GITHUB_APP_ID,
    appSlug: configEnv.GITHUB_APP_SLUG,
    clientId: configEnv.GITHUB_APP_CLIENT_ID,
    clientSecret: configEnv.GITHUB_APP_CLIENT_SECRET,
    privateKey: configEnv.GITHUB_APP_PRIVATE_KEY,
  };
  const { appId, appSlug, clientId, clientSecret, privateKey } = required;

  if (!(appId && appSlug && clientId && clientSecret && privateKey)) {
    throw new Error("GitHub App environment is incomplete.");
  }

  return {
    apiVersion: required.apiVersion,
    appId,
    appSlug,
    clientId,
    clientSecret,
    privateKey,
  };
}
