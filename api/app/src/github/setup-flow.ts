import { db } from "@db/app/client";
import {
  finalizeActiveOrgProviderBinding,
  isOrgBound,
  OrgSourceControlBindingConflictError,
} from "@db/app";
import {
  GITHUB_OAUTH_CALLBACK_PATH,
  githubInstallationMetadataSchema,
  type GitHubBindErrorCode,
} from "@repo/github-app-contract";
import {
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  GitHubAppNodeError,
  verifyGitHubEmulatorInstallation,
} from "@repo/github-app-node";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgBinding } from "../auth/org-binding-mirror";
import {
  assertCurrentUserIsOrgAdmin,
  GitHubSetupAdminAccessError,
} from "./admin-access";
import {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubOAuthAttempt,
} from "./bind-attempts";
import { getGitHubEmulatorConfig } from "./config";

function bindPageUrl(input: {
  appOrigin: string;
  code?: GitHubBindErrorCode;
  orgSlug: string;
}): string {
  const url = new URL(`/${input.orgSlug}/tasks/bind`, input.appOrigin);
  if (input.code) {
    url.searchParams.set("github_error", input.code);
  }
  return url.toString();
}

function completionPageUrl(input: { appOrigin: string; orgSlug: string }) {
  return new URL(
    `/${input.orgSlug}/tasks/bind/github/complete`,
    input.appOrigin
  ).toString();
}

export interface GitHubRedirectResult {
  redirectUrl: string;
}

function missingAttemptRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GitHubRedirectResult {
  void input.requestUrl;
  // Missing/expired attempts have no trusted org slug. Use the neutral
  // account-level team surface instead of shaping an org path from query data.
  const url = new URL("/account/teams", input.appOrigin);
  url.searchParams.set("github_error", "expired_state");
  return {
    redirectUrl: url.toString(),
  };
}

function errorRedirect(input: {
  appOrigin: string;
  code: GitHubBindErrorCode;
  orgSlug: string;
}): GitHubRedirectResult {
  return { redirectUrl: bindPageUrl(input) };
}

function mapError(error: unknown): GitHubBindErrorCode {
  if (error instanceof GitHubSetupAdminAccessError) {
    return "permission_required";
  }

  if (error instanceof OrgSourceControlBindingConflictError) {
    return error.code === "INSTALLATION_ALREADY_BOUND"
      ? "installation_already_bound"
      : "org_already_bound";
  }

  if (error instanceof GitHubAppNodeError) {
    switch (error.code) {
      case "INSTALLATION_NOT_VERIFIED":
        return "installation_not_verified";
      case "PERSONAL_ACCOUNT_NOT_SUPPORTED":
        return "personal_account_not_supported";
      case "GITHUB_OAUTH_EXCHANGE_FAILED":
        return "github_transient_error";
    }
  }

  return "github_transient_error";
}

export async function completeGitHubInstallationSetup(input: {
  appOrigin: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const requestUrl = new URL(input.requestUrl);
  const state = requestUrl.searchParams.get("state");
  const installationId = requestUrl.searchParams.get("installation_id");
  const setupAction = requestUrl.searchParams.get("setup_action") ?? undefined;

  if (!(state && installationId)) {
    return missingAttemptRedirect(input);
  }

  const attempt = await consumeGitHubInstallAttempt({ state });
  if (!attempt) {
    return missingAttemptRedirect(input);
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: attempt.clerkOrgId,
      expectedUserId: attempt.lightfastUserId,
    });

    if (installationId !== attempt.emulator.installationId) {
      return errorRedirect({
        appOrigin: input.appOrigin,
        code: "installation_not_verified",
        orgSlug: attempt.orgSlug,
      });
    }

    const config = getGitHubEmulatorConfig({ appOrigin: input.appOrigin });
    const pkce = createGitHubPkcePair();
    const oauthAttempt = await issueGitHubOAuthAttempt({
      clerkOrgId: attempt.clerkOrgId,
      codeVerifier: pkce.codeVerifier,
      emulator: attempt.emulator,
      lightfastUserId: attempt.lightfastUserId,
      orgSlug: attempt.orgSlug,
      providerInstallationId: installationId,
    });

    const authorizeUrl = buildGitHubOAuthAuthorizeUrl({
      authorizationBaseUrl: `${attempt.emulator.emulatorOrigin}/login/oauth/authorize`,
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      redirectUri: new URL(
        GITHUB_OAUTH_CALLBACK_PATH,
        input.appOrigin
      ).toString(),
      state: oauthAttempt.state,
    });

    log.info("[github-setup] installation setup verified", {
      clerkOrgId: attempt.clerkOrgId,
      orgSlug: attempt.orgSlug,
      setupAction,
    });

    return { redirectUrl: authorizeUrl };
  } catch (error) {
    return errorRedirect({
      appOrigin: input.appOrigin,
      code: mapError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}

export async function completeGitHubOAuthVerification(input: {
  appOrigin: string;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const requestUrl = new URL(input.requestUrl);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const denied = requestUrl.searchParams.get("error");

  if (denied) {
    if (!state) {
      return missingAttemptRedirect(input);
    }
    const attempt = await consumeGitHubOAuthAttempt({ state });
    return attempt
      ? errorRedirect({
          appOrigin: input.appOrigin,
          code: "github_authorization_denied",
          orgSlug: attempt.orgSlug,
        })
      : missingAttemptRedirect(input);
  }
  if (!(code && state)) {
    return missingAttemptRedirect(input);
  }

  const attempt = await consumeGitHubOAuthAttempt({ state });
  if (!attempt) {
    return missingAttemptRedirect(input);
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: attempt.clerkOrgId,
      expectedUserId: attempt.lightfastUserId,
    });

    const config = getGitHubEmulatorConfig({ appOrigin: input.appOrigin });
    const token = await exchangeGitHubOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier: attempt.codeVerifier,
      redirectUri: new URL(
        GITHUB_OAUTH_CALLBACK_PATH,
        input.appOrigin
      ).toString(),
      tokenUrl: `${attempt.emulator.emulatorOrigin}/login/oauth/access_token`,
    });

    const installation = await verifyGitHubEmulatorInstallation({
      emulatorOrigin: attempt.emulator.emulatorOrigin,
      expectedInstallationId: attempt.providerInstallationId,
      expectedOrgLogin: attempt.emulator.providerAccountLogin,
      userAccessToken: token.accessToken,
    });

    const metadata = githubInstallationMetadataSchema.parse({
      events: installation.events,
      githubAppId: installation.appId,
      githubAppSlug: installation.appSlug,
      githubSetupAction: requestUrl.searchParams.get("setup_action") ?? undefined,
      permissions: installation.permissions,
      repositorySelection: installation.repositorySelection,
      verifiedBy: "github_emulator",
    });

    await finalizeActiveOrgProviderBinding(db, {
      clerkOrgId: attempt.clerkOrgId,
      connectedByUserId: attempt.lightfastUserId,
      metadata,
      provider: "github",
      providerAccountId: installation.account.id,
      providerAccountLogin: installation.account.login,
      providerInstallationId: installation.id,
    });

    try {
      await mirrorOrgBinding({
        clerkOrgId: attempt.clerkOrgId,
        provider: "github",
        status: "bound",
      });
    } catch (error) {
      log.warn("[github-setup] org binding mirror failed", {
        clerkOrgId: attempt.clerkOrgId,
        error,
      });
    }

    return {
      redirectUrl: completionPageUrl({
        appOrigin: input.appOrigin,
        orgSlug: attempt.orgSlug,
      }),
    };
  } catch (error) {
    return errorRedirect({
      appOrigin: input.appOrigin,
      code: mapError(error),
      orgSlug: attempt.orgSlug,
    });
  }
}

export async function syncGitHubBindingClaim(input: {
  clerkOrgId: string;
}): Promise<{ bindingStatus: "bound" | "unbound" }> {
  const bound = await isOrgBound(db, input.clerkOrgId);
  if (bound) {
    await mirrorOrgBinding({
      clerkOrgId: input.clerkOrgId,
      provider: "github",
      status: "bound",
    });
  }
  return { bindingStatus: bound ? "bound" : "unbound" };
}
