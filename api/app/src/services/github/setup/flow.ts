import { GITHUB_OAUTH_CALLBACK_PATH } from "@lightfast/connector-github/contract";
import {
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  verifyGitHubUserInstallation,
} from "@lightfast/connector-github/node";
import { log } from "@vendor/observability/log/next";

import { assertCurrentUserIsOrgAdmin } from "../../../auth/clerk-org-membership";
import { getGitHubAppConfig, resolveGitHubAppOrigin } from "../config";
import {
  consumeGitHubInstallAttempt,
  consumeGitHubOAuthAttempt,
  issueGitHubOAuthAttempt,
  lookupGitHubInstallAttempt,
  lookupGitHubOAuthAttempt,
} from "./attempts";
import {
  parseGitHubInstallationSetupCallback,
  parseGitHubOAuthCallback,
} from "./callbacks";
import { isUnauthenticatedSetupError, mapGitHubSetupError } from "./errors";
import { finalizeGitHubOrgBinding } from "./finalize-binding";
import {
  completionPageUrl,
  errorRedirect,
  type GitHubRedirectResult,
  type GitHubSetupRedirectPaths,
  missingAttemptRedirect,
  signInRedirect,
} from "./redirects";

export { syncGitHubBindingClaim } from "./finalize-binding";
export type {
  GitHubRedirectResult,
  GitHubSetupRedirectPaths,
} from "./redirects";

export async function completeGitHubInstallationSetup(input: {
  appOrigin?: string;
  redirectPaths: GitHubSetupRedirectPaths;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const parsed = parseGitHubInstallationSetupCallback(input.requestUrl);
  if (!parsed) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  const pendingAttempt = await lookupGitHubInstallAttempt({
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({
        appOrigin,
        redirectPaths: input.redirectPaths,
        requestUrl: input.requestUrl,
      });
    }
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
      redirectPaths: input.redirectPaths,
    });
  }

  const attempt = await consumeGitHubInstallAttempt({ state: parsed.state });
  if (!attempt) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  try {
    const config = getGitHubAppConfig();
    const pkce = createGitHubPkcePair();
    const oauthAttempt = await issueGitHubOAuthAttempt({
      clerkOrgId: attempt.clerkOrgId,
      codeVerifier: pkce.codeVerifier,
      lightfastUserId: attempt.lightfastUserId,
      orgSlug: attempt.orgSlug,
      providerInstallationId: parsed.installationId,
      setupAction: parsed.setupAction,
    });

    const authorizeUrl = buildGitHubOAuthAuthorizeUrl({
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
      redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, appOrigin).toString(),
      state: oauthAttempt.state,
    });

    log.info("[github-setup] installation setup verified", {
      clerkOrgId: attempt.clerkOrgId,
      orgSlug: attempt.orgSlug,
      setupAction: parsed.setupAction,
    });

    return { redirectUrl: authorizeUrl };
  } catch (error) {
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: attempt.orgSlug,
      redirectPaths: input.redirectPaths,
    });
  }
}

async function consumeDeniedOAuthCallback(input: {
  appOrigin: string;
  redirectPaths: GitHubSetupRedirectPaths;
  requestUrl: string;
  state: string | null;
}): Promise<GitHubRedirectResult> {
  if (!input.state) {
    return missingAttemptRedirect({
      appOrigin: input.appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  const pendingAttempt = await lookupGitHubOAuthAttempt({ state: input.state });
  if (!pendingAttempt) {
    return missingAttemptRedirect({
      appOrigin: input.appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({
        appOrigin: input.appOrigin,
        redirectPaths: input.redirectPaths,
        requestUrl: input.requestUrl,
      });
    }
    return errorRedirect({
      appOrigin: input.appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
      redirectPaths: input.redirectPaths,
    });
  }

  const attempt = await consumeGitHubOAuthAttempt({ state: input.state });
  return attempt
    ? errorRedirect({
        appOrigin: input.appOrigin,
        code: "github_authorization_denied",
        orgSlug: attempt.orgSlug,
        redirectPaths: input.redirectPaths,
      })
    : missingAttemptRedirect({
        appOrigin: input.appOrigin,
        redirectPaths: input.redirectPaths,
      });
}

export async function completeGitHubOAuthVerification(input: {
  appOrigin?: string;
  redirectPaths: GitHubSetupRedirectPaths;
  requestUrl: string;
}): Promise<GitHubRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const parsed = parseGitHubOAuthCallback(input.requestUrl);

  if (parsed.denied) {
    return consumeDeniedOAuthCallback({
      appOrigin,
      redirectPaths: input.redirectPaths,
      requestUrl: input.requestUrl,
      state: parsed.state,
    });
  }

  if (!(parsed.code && parsed.state)) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  const pendingAttempt = await lookupGitHubOAuthAttempt({
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  try {
    await assertCurrentUserIsOrgAdmin({
      clerkOrgId: pendingAttempt.clerkOrgId,
      expectedUserId: pendingAttempt.lightfastUserId,
    });
  } catch (error) {
    if (isUnauthenticatedSetupError(error)) {
      return signInRedirect({
        appOrigin,
        redirectPaths: input.redirectPaths,
        requestUrl: input.requestUrl,
      });
    }
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: pendingAttempt.orgSlug,
      redirectPaths: input.redirectPaths,
    });
  }

  const attempt = await consumeGitHubOAuthAttempt({ state: parsed.state });
  if (!attempt) {
    return missingAttemptRedirect({
      appOrigin,
      redirectPaths: input.redirectPaths,
    });
  }

  try {
    const config = getGitHubAppConfig();
    const token = await exchangeGitHubOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: parsed.code,
      codeVerifier: attempt.codeVerifier,
      redirectUri: new URL(GITHUB_OAUTH_CALLBACK_PATH, appOrigin).toString(),
      tokenUrl: config.endpoints.oauthTokenUrl,
    });

    const installation = await verifyGitHubUserInstallation({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      expectedInstallationId: attempt.providerInstallationId,
      userAccessToken: token.accessToken,
    });

    await finalizeGitHubOrgBinding({
      clerkOrgId: attempt.clerkOrgId,
      connectedByUserId: attempt.lightfastUserId,
      installation,
      setupAction: attempt.setupAction,
    });

    return {
      redirectUrl: completionPageUrl({
        appOrigin,
        orgSlug: attempt.orgSlug,
        redirectPaths: input.redirectPaths,
      }),
    };
  } catch (error) {
    return errorRedirect({
      appOrigin,
      code: mapGitHubSetupError(error),
      orgSlug: attempt.orgSlug,
      redirectPaths: input.redirectPaths,
    });
  }
}
