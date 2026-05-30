import {
  getActiveUserSourceControlAccount,
  markUserSourceControlAccountRevoked,
} from "@db/app";
import { db } from "@db/app/client";
import { GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH } from "@repo/github-app-contract";
import {
  buildGitHubOAuthAuthorizeUrl,
  createGitHubPkcePair,
  exchangeGitHubOAuthCode,
  getGitHubAuthenticatedUser,
  revokeGitHubOAuthGrant,
} from "@repo/github-app-node";
import { auth } from "@vendor/clerk/server";

import { getGitHubAppConfig, resolveGitHubAppOrigin } from "../config";
import {
  consumeGitHubUserAccountOAuthAttempt,
  type GitHubUserAccountOAuthAttemptRecord,
  issueGitHubUserAccountOAuthAttempt,
  lookupGitHubUserAccountOAuthAttempt,
} from "./attempts";
import { parseGitHubUserAccountOAuthCallback } from "./callbacks";
import { mapGitHubUserAccountError } from "./errors";
import { finalizeGitHubUserAccountBinding } from "./finalize-account";
import {
  accountTaskErrorRedirect,
  type GitHubUserAccountRedirectResult,
  missingUserAccountAttemptRedirect,
  userAccountCompleteUrl,
  userAccountSignInRedirect,
} from "./redirects";
import { getFreshGitHubUserAccessToken } from "./refresh";

export type { GitHubUserAccountRedirectResult } from "./redirects";

export async function startGitHubUserAccountBinding(input: {
  lightfastUserId: string;
  returnTo?: string;
}): Promise<{ authorizationUrl: string }> {
  const appOrigin = resolveGitHubAppOrigin();
  const config = getGitHubAppConfig();
  const pkce = createGitHubPkcePair();
  const attempt = await issueGitHubUserAccountOAuthAttempt({
    codeVerifier: pkce.codeVerifier,
    lightfastUserId: input.lightfastUserId,
    ...optionalReturnTo(input.returnTo),
  });

  return {
    authorizationUrl: buildGitHubOAuthAuthorizeUrl({
      clientId: config.clientId,
      codeChallenge: pkce.codeChallenge,
      oauthAuthorizeUrl: config.endpoints.oauthAuthorizeUrl,
      redirectUri: new URL(
        GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
        appOrigin
      ).toString(),
      state: attempt.state,
    }),
  };
}

export async function completeGitHubUserAccountOAuth(input: {
  appOrigin?: string;
  requestUrl: string;
}): Promise<GitHubUserAccountRedirectResult> {
  const appOrigin = input.appOrigin ?? resolveGitHubAppOrigin();
  const parsed = parseGitHubUserAccountOAuthCallback(input.requestUrl);

  if (parsed.denied) {
    return consumeDeniedOAuthCallback({
      appOrigin,
      requestUrl: input.requestUrl,
      state: parsed.state,
    });
  }

  if (!(parsed.code && parsed.state)) {
    return missingUserAccountAttemptRedirect({ appOrigin });
  }

  const pendingAttempt = await lookupGitHubUserAccountOAuthAttempt({
    state: parsed.state,
  });
  if (!pendingAttempt) {
    return missingUserAccountAttemptRedirect({ appOrigin });
  }

  const authRedirect = await validateAuthenticatedAttemptUser({
    appOrigin,
    attempt: pendingAttempt,
    requestUrl: input.requestUrl,
  });
  if (authRedirect) {
    return authRedirect;
  }

  const attempt = await consumeGitHubUserAccountOAuthAttempt({
    state: parsed.state,
  });
  if (!attempt) {
    return missingUserAccountAttemptRedirect({ appOrigin });
  }

  try {
    const config = getGitHubAppConfig();
    const token = await exchangeGitHubOAuthCode({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: parsed.code,
      codeVerifier: attempt.codeVerifier,
      redirectUri: new URL(
        GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
        appOrigin
      ).toString(),
      tokenUrl: config.endpoints.oauthTokenUrl,
    });

    if (
      token.accessTokenExpiresIn === undefined ||
      !token.refreshToken ||
      token.refreshTokenExpiresIn === undefined
    ) {
      return accountTaskErrorRedirect({
        appOrigin,
        code: "missing_refresh_token",
      });
    }

    const user = await getGitHubAuthenticatedUser({
      apiBaseUrl: config.endpoints.apiBaseUrl,
      apiVersion: config.apiVersion,
      userAccessToken: token.accessToken,
    });
    const now = Date.now();

    await finalizeGitHubUserAccountBinding({
      accessToken: token.accessToken,
      accessTokenExpiresAt: new Date(now + token.accessTokenExpiresIn * 1000),
      clerkUserId: attempt.lightfastUserId,
      providerUserId: user.id,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: new Date(now + token.refreshTokenExpiresIn * 1000),
    });

    return {
      redirectUrl: userAccountCompleteUrl({
        appOrigin,
        returnTo: normalizeReturnTo(attempt.returnTo),
      }),
    };
  } catch (error) {
    return accountTaskErrorRedirect({
      appOrigin,
      code: mapGitHubUserAccountError(error),
    });
  }
}

function optionalReturnTo(returnTo: string | undefined): { returnTo?: string } {
  const normalized = normalizeReturnTo(returnTo);
  return normalized === undefined ? {} : { returnTo: normalized };
}

function normalizeReturnTo(returnTo: string | undefined): string | undefined {
  if (!returnTo) {
    return;
  }

  if (
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.startsWith("/\\")
  ) {
    return;
  }

  return returnTo;
}

export async function getGitHubUserAccountStatus(input: {
  clerkUserId: string;
}): Promise<{
  account: null | {
    accessTokenExpiresAt: Date;
    connectedAt: Date;
    provider: "github";
    providerUserId: string;
    refreshTokenExpiresAt: Date;
    status: "active";
  };
}> {
  const account = await getActiveUserSourceControlAccount(
    db,
    input.clerkUserId
  );
  if (!account) {
    return { account: null };
  }

  return {
    account: {
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      connectedAt: account.connectedAt,
      provider: account.provider,
      providerUserId: account.providerUserId,
      refreshTokenExpiresAt: account.refreshTokenExpiresAt,
      status: "active",
    },
  };
}

export async function disconnectGitHubUserAccount(input: {
  clerkUserId: string;
}): Promise<{ ok: true }> {
  const account = await getActiveUserSourceControlAccount(
    db,
    input.clerkUserId
  );
  if (!account) {
    return { ok: true };
  }

  const config = getGitHubAppConfig();
  const { accessToken } = await getFreshGitHubUserAccessToken({
    clerkUserId: input.clerkUserId,
    db,
  });
  await revokeGitHubOAuthGrant({
    accessToken,
    apiBaseUrl: config.endpoints.apiBaseUrl,
    apiVersion: config.apiVersion,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  await markUserSourceControlAccountRevoked(db, {
    clerkUserId: input.clerkUserId,
  });
  return { ok: true };
}

async function consumeDeniedOAuthCallback(input: {
  appOrigin: string;
  requestUrl: string;
  state: string | null;
}): Promise<GitHubUserAccountRedirectResult> {
  if (!input.state) {
    return missingUserAccountAttemptRedirect({ appOrigin: input.appOrigin });
  }

  const pendingAttempt = await lookupGitHubUserAccountOAuthAttempt({
    state: input.state,
  });
  if (!pendingAttempt) {
    return missingUserAccountAttemptRedirect({ appOrigin: input.appOrigin });
  }

  const authRedirect = await validateAuthenticatedAttemptUser({
    appOrigin: input.appOrigin,
    attempt: pendingAttempt,
    requestUrl: input.requestUrl,
  });
  if (authRedirect) {
    return authRedirect;
  }

  const attempt = await consumeGitHubUserAccountOAuthAttempt({
    state: input.state,
  });
  return attempt
    ? accountTaskErrorRedirect({
        appOrigin: input.appOrigin,
        code: "github_authorization_denied",
      })
    : missingUserAccountAttemptRedirect({ appOrigin: input.appOrigin });
}

async function validateAuthenticatedAttemptUser(input: {
  appOrigin: string;
  attempt: GitHubUserAccountOAuthAttemptRecord;
  requestUrl: string;
}): Promise<GitHubUserAccountRedirectResult | null> {
  const { userId } = await auth();
  if (!userId) {
    return userAccountSignInRedirect({
      appOrigin: input.appOrigin,
      requestUrl: input.requestUrl,
    });
  }

  if (userId !== input.attempt.lightfastUserId) {
    return accountTaskErrorRedirect({
      appOrigin: input.appOrigin,
      code: "permission_required",
    });
  }

  return null;
}
