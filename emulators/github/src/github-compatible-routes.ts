import { Buffer } from "node:buffer";
import { createHash, createPublicKey, randomBytes } from "node:crypto";
import type { Store, TokenMap } from "@emulators/core";
import { getGitHubStore } from "@emulators/github";
import {
  GITHUB_SETUP_PATH,
  GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
} from "@repo/github-app-contract";
import { jwtVerify } from "jose";

import { GITHUB_EMULATOR_FIXTURES } from "./fixtures";

interface PendingOAuthCode {
  appId: number;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
  login: string;
  redirectUri: string;
}

interface OAuthUserToken {
  appId: number;
  clientId: string;
  expiresAt: number;
  login: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: number | null;
  scopes: string[];
}

interface GitHubCompatibleFetchInput {
  appOrigin: string;
  fallbackFetch: (request: Request) => Response | Promise<Response>;
  publicOrigin: string;
  resetStore: () => void;
  store: Store;
  tokenMap: TokenMap;
}

const PENDING_CODES_KEY = "lightfast.github.oauth.pendingCodes";
const OAUTH_USER_TOKENS_KEY = "lightfast.github.oauth.userTokens";
const CODE_TTL_MS = 5 * 60 * 1000;
const USER_ACCOUNT_ACCESS_TOKEN_TTL_MS = 28_800 * 1000;
const USER_ACCOUNT_REFRESH_TOKEN_TTL_MS = 15_768_000 * 1000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function notFound() {
  return json({ message: "Not Found" }, 404);
}

function getPendingCodes(store: Store) {
  let codes = store.getData<Map<string, PendingOAuthCode>>(PENDING_CODES_KEY);
  if (!codes) {
    codes = new Map();
    store.setData(PENDING_CODES_KEY, codes);
  }
  return codes;
}

function getOAuthUserTokens(store: Store) {
  let tokens = store.getData<Map<string, OAuthUserToken>>(
    OAUTH_USER_TOKENS_KEY
  );
  if (!tokens) {
    tokens = new Map();
    store.setData(OAUTH_USER_TOKENS_KEY, tokens);
  }
  return tokens;
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

function getBasicCredentials(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match?.[1]) {
    return null;
  }

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  return {
    clientId: decoded.slice(0, separatorIndex),
    clientSecret: decoded.slice(separatorIndex + 1),
  };
}

async function authenticateApp(input: { request: Request; store: Store }) {
  const token = getBearerToken(input.request);
  if (!token) {
    return null;
  }

  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    ) as { iss?: unknown };
    const appId =
      typeof payload.iss === "string"
        ? Number.parseInt(payload.iss, 10)
        : payload.iss;
    if (!(typeof appId === "number" && Number.isFinite(appId))) {
      return null;
    }

    const gh = getGitHubStore(input.store);
    const app = gh.apps.findOneBy("app_id", appId);
    if (!app) {
      return null;
    }

    await jwtVerify(token, createPublicKey(app.private_key), {
      algorithms: ["RS256"],
    });
    return app;
  } catch {
    return null;
  }
}

function authenticateUser(input: { request: Request; store: Store }) {
  const token = getBearerToken(input.request);
  if (!token) {
    return null;
  }
  const oauthTokens = getOAuthUserTokens(input.store);
  const oauthToken = oauthTokens.get(token);
  if (!oauthToken) {
    return null;
  }
  if (oauthToken.expiresAt <= Date.now()) {
    return null;
  }
  const gh = getGitHubStore(input.store);
  const user = gh.users.findOneBy("login", oauthToken.login);
  if (!user) {
    return null;
  }
  return { oauthToken, user };
}

function rejectExpiredOAuthAccessTokenForFallback(input: {
  request: Request;
  store: Store;
  tokenMap: TokenMap;
}) {
  const token = getBearerToken(input.request);
  if (!token) {
    return null;
  }
  const oauthToken = getOAuthUserTokens(input.store).get(token);
  if (!oauthToken || oauthToken.expiresAt > Date.now()) {
    return null;
  }
  input.tokenMap.delete(token);
  return json({ message: "Bad credentials" }, 401);
}

function validatePkce(input: { codeChallenge: string; codeVerifier: string }) {
  const challenge = createHash("sha256")
    .update(input.codeVerifier)
    .digest("base64url");
  return challenge === input.codeChallenge;
}

function isUserAccountRedirectUri(redirectUri: string) {
  return (
    new URL(redirectUri).pathname === GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH
  );
}

function createOAuthToken(prefix: "gho" | "ghr" | "ghu") {
  return `${prefix}_${randomBytes(20).toString("base64url")}`;
}

function setOAuthToken(input: {
  appId: number;
  clientId: string;
  expiresAt: number;
  login: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: number | null;
  scopes: string[];
  store: Store;
  token: string;
  tokenMap: TokenMap;
  userId: number;
}) {
  getOAuthUserTokens(input.store).set(input.token, {
    appId: input.appId,
    clientId: input.clientId,
    expiresAt: input.expiresAt,
    login: input.login,
    refreshToken: input.refreshToken,
    refreshTokenExpiresAt: input.refreshTokenExpiresAt,
    scopes: input.scopes,
  });
  input.tokenMap.set(input.token, {
    id: input.userId,
    login: input.login,
    scopes: input.scopes,
  });
}

function refreshableTokenResponse(input: {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}) {
  return {
    access_token: input.accessToken,
    expires_in: 28_800,
    refresh_token: input.refreshToken,
    refresh_token_expires_in: 15_768_000,
    token_type: "bearer",
    scope: input.scopes.join(" "),
  };
}

function formatInstallation(input: {
  installationId: number;
  publicOrigin: string;
  store: Store;
}) {
  const gh = getGitHubStore(input.store);
  const installation = gh.appInstallations
    .all()
    .find((candidate) => candidate.installation_id === input.installationId);
  if (!installation) {
    return null;
  }
  const app = gh.apps
    .all()
    .find((candidate) => candidate.app_id === installation.app_id);
  const account =
    installation.account_type === "Organization"
      ? gh.orgs.get(installation.account_id)
      : gh.users.get(installation.account_id);
  if (!account) {
    return null;
  }

  return {
    id: installation.installation_id,
    account: {
      id: account.id,
      login: account.login,
      node_id: account.node_id,
      type: installation.account_type,
      avatar_url: `${input.publicOrigin}/avatars/u/${account.login}`,
      url: `${input.publicOrigin}/${
        installation.account_type === "Organization" ? "orgs" : "users"
      }/${account.login}`,
    },
    access_tokens_url: `${input.publicOrigin}/app/installations/${installation.installation_id}/access_tokens`,
    app_id: installation.app_id,
    app_slug: app?.slug ?? null,
    events: installation.events,
    html_url: `${input.publicOrigin}/settings/installations/${installation.installation_id}`,
    permissions: installation.permissions,
    repositories_url: `${input.publicOrigin}/installation/repositories`,
    repository_selection: installation.repository_selection,
    single_file_name: null,
    has_multiple_single_files: false,
    single_file_paths: [],
    suspended_at: installation.suspended_at,
    suspended_by: null,
    target_type: installation.account_type,
  };
}

function userOrgIds(input: { store: Store; userId: number }) {
  const gh = getGitHubStore(input.store);
  const teamIds = gh.teamMembers
    .findBy("user_id", input.userId)
    .map((member) => member.team_id);
  return new Set(
    teamIds
      .map((teamId) => gh.teams.get(teamId)?.org_id)
      .filter((orgId): orgId is number => typeof orgId === "number")
  );
}

function findInstallationActor(input: { accountId: number; store: Store }) {
  const gh = getGitHubStore(input.store);
  const teams = gh.teams.findBy("org_id", input.accountId);
  for (const team of teams) {
    const member = gh.teamMembers.findBy("team_id", team.id)[0];
    if (!member) {
      continue;
    }
    const user = gh.users.get(member.user_id);
    if (user) {
      return user;
    }
  }
  return;
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const text = await request.text();
  if (contentType.includes("application/json")) {
    return JSON.parse(text || "{}") as Record<string, unknown>;
  }
  return Object.fromEntries(new URLSearchParams(text));
}

export function createGitHubCompatibleFetch(input: GitHubCompatibleFetchInput) {
  return async function gitHubCompatibleFetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/__lightfast/reset") {
      const token = getBearerToken(request);
      if (token !== GITHUB_EMULATOR_FIXTURES.userToken) {
        return json({ message: "Bad credentials" }, 401);
      }

      input.resetStore();
      return json({
        ok: true,
        installationId: GITHUB_EMULATOR_FIXTURES.installationId,
        org: GITHUB_EMULATOR_FIXTURES.githubOrgLogin,
      });
    }

    const gh = getGitHubStore(input.store);

    const installMatch = /^\/apps\/([^/]+)\/installations\/new$/.exec(
      url.pathname
    );
    if (request.method === "GET" && installMatch) {
      const slug = installMatch[1];
      if (!slug) {
        return notFound();
      }
      const app = gh.apps.findOneBy("slug", slug);
      if (!app) {
        return notFound();
      }
      const installation = gh.appInstallations
        .findBy("app_id", app.app_id)
        .find(
          (candidate) =>
            candidate.installation_id ===
            GITHUB_EMULATOR_FIXTURES.installationId
        );
      const state = url.searchParams.get("state");
      if (!(installation && state)) {
        return json({ message: "Bad Request" }, 400);
      }
      const redirectUrl = new URL(GITHUB_SETUP_PATH, input.appOrigin);
      redirectUrl.searchParams.set(
        "installation_id",
        String(installation.installation_id)
      );
      redirectUrl.searchParams.set("setup_action", "install");
      redirectUrl.searchParams.set("state", state);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (request.method === "GET" && url.pathname === "/login/oauth/authorize") {
      const clientId = url.searchParams.get("client_id") ?? "";
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const codeChallenge = url.searchParams.get("code_challenge") ?? "";
      const codeChallengeMethod =
        url.searchParams.get("code_challenge_method") ?? "";
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);
      if (
        !(
          oauthApp?.redirect_uris.includes(redirectUri) &&
          state &&
          codeChallenge
        ) ||
        codeChallengeMethod !== "S256"
      ) {
        return json({ message: "Bad Request" }, 400);
      }

      const code = randomBytes(20).toString("hex");
      getPendingCodes(input.store).set(code, {
        appId: GITHUB_EMULATOR_FIXTURES.githubAppId,
        clientId,
        codeChallenge,
        codeChallengeMethod,
        expiresAt: Date.now() + CODE_TTL_MS,
        login: GITHUB_EMULATOR_FIXTURES.githubUserLogin,
        redirectUri,
      });
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      return Response.redirect(callbackUrl.toString(), 302);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/login/oauth/access_token"
    ) {
      const body: Record<string, unknown> = await readBody(request).catch(
        () => ({})
      );
      const clientId = String(body.client_id ?? "");
      const clientSecret = String(body.client_secret ?? "");
      const grantType = String(body.grant_type ?? "");
      const code = String(body.code ?? "");
      const codeVerifier = String(body.code_verifier ?? "");
      const refreshToken = String(body.refresh_token ?? "");
      const redirectUri = String(body.redirect_uri ?? "");
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);

      if (grantType === "refresh_token") {
        const tokens = getOAuthUserTokens(input.store);
        const previousEntry = Array.from(tokens.entries()).find(
          ([, token]) => token.refreshToken === refreshToken
        );
        const previousToken = previousEntry?.[1];
        if (
          !oauthApp ||
          oauthApp.client_secret !== clientSecret ||
          !previousEntry ||
          !previousToken ||
          previousToken.clientId !== clientId ||
          !previousToken.refreshTokenExpiresAt ||
          previousToken.refreshTokenExpiresAt <= Date.now()
        ) {
          return json({
            error: "bad_refresh_token",
            error_description:
              "The refresh token passed is incorrect or expired.",
          });
        }

        const user = gh.users.findOneBy("login", previousToken.login);
        if (!user) {
          return json({
            error: "bad_refresh_token",
            error_description:
              "The refresh token passed is incorrect or expired.",
          });
        }

        const nextAccessToken = createOAuthToken("ghu");
        const nextRefreshToken = createOAuthToken("ghr");
        tokens.delete(previousEntry[0]);
        input.tokenMap.delete(previousEntry[0]);
        setOAuthToken({
          appId: previousToken.appId,
          clientId: previousToken.clientId,
          expiresAt: Date.now() + USER_ACCOUNT_ACCESS_TOKEN_TTL_MS,
          login: user.login,
          refreshToken: nextRefreshToken,
          refreshTokenExpiresAt: Date.now() + USER_ACCOUNT_REFRESH_TOKEN_TTL_MS,
          scopes: previousToken.scopes,
          store: input.store,
          token: nextAccessToken,
          tokenMap: input.tokenMap,
          userId: user.id,
        });

        return json(
          refreshableTokenResponse({
            accessToken: nextAccessToken,
            refreshToken: nextRefreshToken,
            scopes: previousToken.scopes,
          })
        );
      }

      const pendingCodes = getPendingCodes(input.store);
      const pending = pendingCodes.get(code);
      if (pending?.expiresAt && pending.expiresAt < Date.now()) {
        pendingCodes.delete(code);
      }
      if (
        !oauthApp ||
        oauthApp.client_secret !== clientSecret ||
        !pending ||
        pending.expiresAt < Date.now() ||
        pending.clientId !== clientId ||
        pending.redirectUri !== redirectUri ||
        !validatePkce({ codeChallenge: pending.codeChallenge, codeVerifier })
      ) {
        if (pending) {
          pendingCodes.delete(code);
        }
        return json({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
        });
      }

      pendingCodes.delete(code);
      const user = gh.users.findOneBy("login", pending.login);
      if (!user) {
        return json({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
        });
      }
      const scopes = ["repo", "user", "read:org"];
      if (isUserAccountRedirectUri(pending.redirectUri)) {
        const token = createOAuthToken("ghu");
        const tokenRefreshToken = createOAuthToken("ghr");
        setOAuthToken({
          appId: pending.appId,
          clientId: pending.clientId,
          expiresAt: Date.now() + USER_ACCOUNT_ACCESS_TOKEN_TTL_MS,
          login: user.login,
          refreshToken: tokenRefreshToken,
          refreshTokenExpiresAt: Date.now() + USER_ACCOUNT_REFRESH_TOKEN_TTL_MS,
          scopes,
          store: input.store,
          token,
          tokenMap: input.tokenMap,
          userId: user.id,
        });
        return json(
          refreshableTokenResponse({
            accessToken: token,
            refreshToken: tokenRefreshToken,
            scopes,
          })
        );
      }

      const token = createOAuthToken("gho");
      setOAuthToken({
        appId: pending.appId,
        clientId: pending.clientId,
        expiresAt: Number.POSITIVE_INFINITY,
        login: user.login,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        scopes,
        store: input.store,
        token,
        tokenMap: input.tokenMap,
        userId: user.id,
      });
      return json({
        access_token: token,
        token_type: "bearer",
        scope: "repo user read:org",
      });
    }

    const revokeGrantMatch = /^\/applications\/([^/]+)\/grant$/.exec(
      url.pathname
    );
    if (request.method === "DELETE" && revokeGrantMatch) {
      const clientId = decodeURIComponent(revokeGrantMatch[1] ?? "");
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);
      const credentials = getBasicCredentials(request);
      if (
        !oauthApp ||
        credentials?.clientId !== clientId ||
        credentials.clientSecret !== oauthApp.client_secret
      ) {
        return json({ message: "Requires authentication" }, 401);
      }

      const body: Record<string, unknown> = await readBody(request).catch(
        () => ({})
      );
      const accessToken = String(body.access_token ?? "");
      const tokens = getOAuthUserTokens(input.store);
      const tokenEntry = tokens.get(accessToken);
      if (!tokenEntry || tokenEntry.clientId !== clientId) {
        return json({ message: "Validation Failed" }, 422);
      }

      for (const [token, entry] of tokens.entries()) {
        if (
          entry.appId === tokenEntry.appId &&
          entry.clientId === tokenEntry.clientId &&
          entry.login === tokenEntry.login
        ) {
          tokens.delete(token);
          input.tokenMap.delete(token);
        }
      }

      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && url.pathname === "/user") {
      const user = authenticateUser({
        request,
        store: input.store,
      });
      if (!user?.user) {
        return json({ message: "Bad credentials" }, 401);
      }
      return json({
        id: user.user.id,
        login: user.user.login,
        node_id: user.user.node_id,
        type: user.user.type,
        name: user.user.name,
        email: user.user.email,
      });
    }

    if (request.method === "GET" && url.pathname === "/user/installations") {
      const user = authenticateUser({
        request,
        store: input.store,
      });
      if (!user?.user) {
        return json({ message: "Bad credentials" }, 401);
      }
      const orgIds = userOrgIds({ store: input.store, userId: user.user.id });
      const installations = gh.appInstallations
        .all()
        .filter((installation) => {
          if (installation.app_id !== user.oauthToken.appId) {
            return false;
          }
          if (installation.account_type === "Organization") {
            return orgIds.has(installation.account_id);
          }
          return (
            installation.account_type === "User" &&
            installation.account_id === user.user.id
          );
        })
        .map((installation) =>
          formatInstallation({
            installationId: installation.installation_id,
            publicOrigin: input.publicOrigin,
            store: input.store,
          })
        )
        .filter(
          (installation): installation is NonNullable<typeof installation> =>
            Boolean(installation)
        );

      return json({
        total_count: installations.length,
        installations,
      });
    }

    const installationTokenMatch =
      /^\/app\/installations\/([^/]+)\/access_tokens$/.exec(url.pathname);
    if (request.method === "POST" && installationTokenMatch) {
      const app = await authenticateApp({
        request,
        store: input.store,
      });
      if (!app) {
        return json(
          {
            message: "A JSON web token could not be decoded",
            documentation_url: "https://docs.github.com/rest",
          },
          401
        );
      }

      const installationId = Number.parseInt(
        installationTokenMatch[1] ?? "",
        10
      );
      const installation = gh.appInstallations
        .all()
        .find(
          (candidate) =>
            candidate.installation_id === installationId &&
            candidate.app_id === app.app_id
        );
      if (!installation) {
        return notFound();
      }

      const actor =
        installation.account_type === "User"
          ? gh.users.get(installation.account_id)
          : findInstallationActor({
              accountId: installation.account_id,
              store: input.store,
            });
      const requestedPermissions = installation.permissions;
      const token = `ghs_${randomBytes(20).toString("base64url")}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      input.tokenMap.set(token, {
        id: actor?.id ?? installation.account_id,
        login: actor?.login ?? installation.account_login,
        scopes: Object.entries(requestedPermissions).map(
          ([key, value]) => `${key}:${value}`
        ),
      });

      return json(
        {
          token,
          expires_at: expiresAt,
          permissions: requestedPermissions,
          repository_selection: installation.repository_selection,
        },
        201
      );
    }

    const expiredOAuthAccessTokenResponse =
      rejectExpiredOAuthAccessTokenForFallback({
        request,
        store: input.store,
        tokenMap: input.tokenMap,
      });
    if (expiredOAuthAccessTokenResponse) {
      return expiredOAuthAccessTokenResponse;
    }

    return input.fallbackFetch(request);
  };
}
