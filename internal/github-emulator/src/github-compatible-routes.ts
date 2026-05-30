import { createHash, randomBytes } from "node:crypto";
import {
  getGitHubStore,
  type Store,
  type TokenMap,
} from "@repo/emulators-github";
import { GITHUB_SETUP_PATH } from "@repo/github-app-contract";

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
  login: string;
  scopes: string[];
}

interface GitHubCompatibleFetchInput {
  appOrigin: string;
  fallbackFetch: (request: Request) => Response | Promise<Response>;
  publicOrigin: string;
  store: Store;
  tokenMap: TokenMap;
}

const PENDING_CODES_KEY = "lightfast.github.oauth.pendingCodes";
const OAUTH_USER_TOKENS_KEY = "lightfast.github.oauth.userTokens";
const CODE_TTL_MS = 5 * 60 * 1000;

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

function authenticateUser(input: { request: Request; store: Store }) {
  const token = getBearerToken(input.request);
  if (!token) {
    return null;
  }
  const oauthToken = getOAuthUserTokens(input.store).get(token);
  if (!oauthToken) {
    return null;
  }
  const gh = getGitHubStore(input.store);
  const user = gh.users.findOneBy("login", oauthToken.login);
  if (!user) {
    return null;
  }
  return { oauthToken, user };
}

function validatePkce(input: { codeChallenge: string; codeVerifier: string }) {
  const challenge = createHash("sha256")
    .update(input.codeVerifier)
    .digest("base64url");
  return challenge === input.codeChallenge;
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
      const code = String(body.code ?? "");
      const codeVerifier = String(body.code_verifier ?? "");
      const redirectUri = String(body.redirect_uri ?? "");
      const oauthApp = gh.oauthApps.findOneBy("client_id", clientId);
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
      const token = `gho_${randomBytes(20).toString("base64url")}`;
      getOAuthUserTokens(input.store).set(token, {
        appId: pending.appId,
        clientId: pending.clientId,
        login: user.login,
        scopes: ["repo", "user", "read:org"],
      });
      input.tokenMap.set(token, {
        id: user.id,
        login: user.login,
        scopes: ["repo", "user", "read:org"],
      });
      return json({
        access_token: token,
        token_type: "bearer",
        scope: "repo user read:org",
      });
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

    return input.fallbackFetch(request);
  };
}
