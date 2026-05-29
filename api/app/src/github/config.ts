import { GITHUB_DEV_INSTALL_PATH } from "@repo/github-app-contract";
import { env } from "../env";

export interface GitHubInstallOverride {
  emulatorOrigin: string;
  installationId: string;
  providerAccountLogin: string;
  url: string;
}

export function normalizeGitHubPrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function resolveGitHubAppOrigin(
  input: { appUrl?: string; installUrlOverride?: string | undefined } = {}
) {
  const installUrlOverride =
    input.installUrlOverride ?? env.GITHUB_INSTALL_URL_OVERRIDE;
  if (installUrlOverride) {
    return new URL(installUrlOverride).origin;
  }

  const appUrl = input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for GitHub app origin resolution."
    );
  }

  return new URL(appUrl).origin;
}

export function parseGitHubInstallOverride(input: {
  appOrigin: string;
  rawUrl: string | undefined;
  vercelEnv: "development" | "preview" | "production";
}): GitHubInstallOverride | null {
  if (!input.rawUrl) {
    return null;
  }
  if (input.vercelEnv === "production") {
    throw new Error(
      "GITHUB_INSTALL_URL_OVERRIDE is not allowed in production."
    );
  }

  const url = new URL(input.rawUrl);
  const appOrigin = new URL(input.appOrigin);
  if (
    url.origin !== appOrigin.origin ||
    url.pathname !== GITHUB_DEV_INSTALL_PATH
  ) {
    throw new Error(
      "GITHUB_INSTALL_URL_OVERRIDE must point at the app dev install shim."
    );
  }

  const emulatorOrigin = url.searchParams.get("emulator_origin");
  const installationId = url.searchParams.get("installation_id");
  const providerAccountLogin = url.searchParams.get("provider_account_login");
  if (!(emulatorOrigin && installationId && providerAccountLogin)) {
    throw new Error("GITHUB_INSTALL_URL_OVERRIDE is missing emulator context.");
  }

  return {
    emulatorOrigin: new URL(emulatorOrigin).origin,
    installationId,
    providerAccountLogin,
    url: url.toString(),
  };
}

export function getGitHubEmulatorConfig(input: { appOrigin?: string } = {}) {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const override = parseGitHubInstallOverride({
    appOrigin,
    rawUrl: env.GITHUB_INSTALL_URL_OVERRIDE,
    vercelEnv: env.VERCEL_ENV,
  });

  if (!override) {
    throw new Error(
      "The emulator slice requires GITHUB_INSTALL_URL_OVERRIDE in non-production."
    );
  }

  if (
    !(
      env.GITHUB_APP_ID &&
      env.GITHUB_APP_SLUG &&
      env.GITHUB_APP_CLIENT_ID &&
      env.GITHUB_APP_CLIENT_SECRET &&
      env.GITHUB_APP_PRIVATE_KEY
    )
  ) {
    throw new Error("GitHub App emulator environment is incomplete.");
  }

  return {
    apiVersion: env.GITHUB_API_VERSION,
    appId: env.GITHUB_APP_ID,
    appSlug: env.GITHUB_APP_SLUG,
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
    installOverride: override,
    privateKey: normalizeGitHubPrivateKey(env.GITHUB_APP_PRIVATE_KEY),
  };
}
