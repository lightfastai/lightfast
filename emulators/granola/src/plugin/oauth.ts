import { createHash } from "node:crypto";

import type { AppEnv, Context, Hono, Store } from "@emulators/core";

import {
  GRANOLA_EMULATOR_FIXTURES,
  GRANOLA_EMULATOR_OAUTH_CODE,
  GRANOLA_EMULATOR_SCOPE,
} from "../fixtures";
import { getFailures } from "./failures";

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const CLIENT_ID_ISSUED_AT = 1_775_000_000;

interface RegisteredClient {
  grant_types?: unknown;
  redirect_uris: string[];
  response_types?: unknown;
  token_endpoint_auth_method?: string;
}

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function originForRequest(c: Context): string {
  const requestUrl = new URL(c.req.url);
  const forwardedHost = firstHeaderValue(c.req.header("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(c.req.header("host"));
  if (host && (forwardedHost || host !== requestUrl.host)) {
    const forwardedProto = firstHeaderValue(c.req.header("x-forwarded-proto"));
    const protocol =
      forwardedProto ??
      (host.endsWith(".localhost")
        ? "https"
        : requestUrl.protocol.replace(":", ""));
    return `${protocol}://${host}`;
  }
  return requestUrl.origin;
}

function tokenResponse() {
  return {
    access_token: GRANOLA_EMULATOR_FIXTURES.accessToken,
    expires_in: TOKEN_EXPIRES_IN_SECONDS,
    refresh_token: GRANOLA_EMULATOR_FIXTURES.refreshToken,
    scope: GRANOLA_EMULATOR_SCOPE,
    token_type: "Bearer",
  };
}

function pkceChallengeFromVerifier(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function registeredClient(store: Store): RegisteredClient | undefined {
  return store.getData<RegisteredClient>("oauth-client");
}

function clientIdValid(clientId: unknown): boolean {
  return String(clientId ?? "") === GRANOLA_EMULATOR_FIXTURES.oauthClientId;
}

export function registerOAuth(app: Hono<AppEnv>, store: Store): void {
  app.get("/.well-known/oauth-protected-resource", (c) => {
    const origin = originForRequest(c);
    return c.json(
      {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        scopes_supported: ["notes:read", "meetings:read"],
        bearer_methods_supported: ["header"],
        resource_name: "Granola Emulator MCP",
      },
      200
    );
  });

  app.get("/.well-known/oauth-protected-resource/mcp", (c) => {
    const origin = originForRequest(c);
    return c.json(
      {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        scopes_supported: ["notes:read", "meetings:read"],
        bearer_methods_supported: ["header"],
        resource_name: "Granola Emulator MCP",
      },
      200
    );
  });

  app.get("/.well-known/oauth-authorization-server", (c) => {
    const origin = originForRequest(c);
    return c.json(
      {
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        registration_endpoint: `${origin}/oauth/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: ["none"],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: ["notes:read", "meetings:read"],
      },
      200
    );
  });

  app.post("/oauth/register", async (c) => {
    const body = (await c.req
      .json()
      .catch(() => null)) as RegisteredClient | null;
    if (
      !(body && Array.isArray(body.redirect_uris)) ||
      body.redirect_uris.length === 0
    ) {
      return c.json({ error: "invalid_client_metadata" }, 400);
    }

    const client: RegisteredClient = {
      grant_types: body.grant_types,
      redirect_uris: body.redirect_uris,
      response_types: body.response_types,
      token_endpoint_auth_method: "none",
    };
    store.setData("oauth-client", client);

    return c.json(
      {
        ...client,
        client_id: GRANOLA_EMULATOR_FIXTURES.oauthClientId,
        client_id_issued_at: CLIENT_ID_ISSUED_AT,
      },
      201
    );
  });

  app.get("/oauth/authorize", (c) => {
    const client = registeredClient(store);
    const clientId = c.req.query("client_id");
    const redirectUri = c.req.query("redirect_uri");
    const codeChallenge = c.req.query("code_challenge");
    const codeChallengeMethod = c.req.query("code_challenge_method");
    const responseType = c.req.query("response_type");

    if (
      !(
        clientIdValid(clientId) &&
        redirectUri &&
        client?.redirect_uris.includes(redirectUri) &&
        codeChallenge
      ) ||
      codeChallengeMethod !== "S256" ||
      responseType !== "code"
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }

    store.setData(`pkce:${GRANOLA_EMULATOR_OAUTH_CODE}`, codeChallenge);

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", GRANOLA_EMULATOR_OAUTH_CODE);
    const state = c.req.query("state");
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }
    return c.redirect(redirectUrl.toString(), 302);
  });

  app.post("/oauth/token", async (c) => {
    const form = await c.req.parseBody();
    const grantType = String(form.grant_type ?? "");
    if (!clientIdValid(form.client_id)) {
      return c.json({ error: "invalid_client" }, 401);
    }

    if (grantType === "authorization_code") {
      const code = String(form.code ?? "");
      const codeVerifier = String(form.code_verifier ?? "");
      const expectedChallenge = store.getData<string>(`pkce:${code}`);

      if (
        code !== GRANOLA_EMULATOR_OAUTH_CODE ||
        !codeVerifier ||
        !expectedChallenge ||
        pkceChallengeFromVerifier(codeVerifier) !== expectedChallenge
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      store.setData(`pkce:${code}`, "");
      return c.json(tokenResponse(), 200);
    }

    if (grantType === "refresh_token") {
      const failures = getFailures(store);
      if (
        failures.refresh ||
        String(form.refresh_token ?? "") !==
          GRANOLA_EMULATOR_FIXTURES.refreshToken
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      return c.json(tokenResponse(), 200);
    }

    return c.json({ error: "unsupported_grant_type" }, 400);
  });
}
