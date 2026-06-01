import { createHash } from "node:crypto";

import type { AppEnv, Hono, Store } from "@emulators/core";

import {
  X_EMULATOR_FIXTURES,
  X_EMULATOR_OAUTH_CODE,
  X_EMULATOR_SCOPE,
} from "../fixtures";
import { getFailures } from "./failures";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 7200;

function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function tokenResponse() {
  return {
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    access_token: X_EMULATOR_FIXTURES.accessToken,
    scope: X_EMULATOR_SCOPE,
    refresh_token: X_EMULATOR_FIXTURES.refreshToken,
  };
}

export function registerOAuth(app: Hono<AppEnv>, store: Store): void {
  app.get("/oauth2/authorize", (c) => {
    const clientId = c.req.query("client_id");
    const redirectUri = c.req.query("redirect_uri");
    const codeChallenge = c.req.query("code_challenge");
    const codeChallengeMethod = c.req.query("code_challenge_method");

    if (
      clientId !== X_EMULATOR_FIXTURES.oauthClientId ||
      !redirectUri ||
      !codeChallenge ||
      codeChallengeMethod !== "S256"
    ) {
      return c.json({ error: "invalid_request" }, 400);
    }

    store.setData(`pkce:${X_EMULATOR_OAUTH_CODE}`, codeChallenge);

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", X_EMULATOR_OAUTH_CODE);
    const state = c.req.query("state");
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }
    return c.redirect(redirectUrl.toString(), 302);
  });

  app.post("/oauth2/token", async (c) => {
    const form = await c.req.parseBody();
    const clientId = String(form.client_id ?? "");
    const grantType = String(form.grant_type ?? "");

    if (clientId !== X_EMULATOR_FIXTURES.oauthClientId) {
      return c.json({ error: "invalid_client" }, 401);
    }

    if (grantType === "authorization_code") {
      const code = String(form.code ?? "");
      const codeVerifier = String(form.code_verifier ?? "");
      const expectedChallenge = store.getData<string>(`pkce:${code}`);

      if (
        code !== X_EMULATOR_OAUTH_CODE ||
        !codeVerifier ||
        !expectedChallenge ||
        pkceChallengeFromVerifier(codeVerifier) !== expectedChallenge
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      return c.json(tokenResponse(), 200);
    }

    if (grantType === "refresh_token") {
      const failures = getFailures(store);
      if (
        failures.refresh ||
        String(form.refresh_token ?? "") !== X_EMULATOR_FIXTURES.refreshToken
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      return c.json(tokenResponse(), 200);
    }

    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  app.post("/oauth2/revoke", async (c) => {
    const form = await c.req.parseBody();
    if (String(form.client_id ?? "") !== X_EMULATOR_FIXTURES.oauthClientId) {
      return c.json({ error: "invalid_client" }, 401);
    }
    const token = String(form.token ?? "");
    if (
      token === X_EMULATOR_FIXTURES.accessToken ||
      token === X_EMULATOR_FIXTURES.refreshToken
    ) {
      return c.body(null, 200);
    }
    return c.json({ error: "invalid_token" }, 400);
  });
}
