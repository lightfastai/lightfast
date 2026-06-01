import type { AppEnv, Hono, Store } from "@emulators/core";

import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_OAUTH_CODE,
} from "../fixtures";
import { getFailures } from "./failures";

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 2_592_000;

function tokenResponse() {
  return {
    access_token: LINEAR_EMULATOR_FIXTURES.accessToken,
    expires_in: TOKEN_EXPIRES_IN_SECONDS,
    refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
    refresh_token_expires_in: REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    scope: "read,write",
    token_type: "Bearer",
  };
}

function clientCredentialsValid(
  clientId: unknown,
  clientSecret: unknown
): boolean {
  return (
    String(clientId ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientId &&
    String(clientSecret ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientSecret
  );
}

export function registerOAuth(app: Hono<AppEnv>, store: Store): void {
  app.get("/oauth/authorize", (c) => {
    const clientId = c.req.query("client_id");
    const redirectUri = c.req.query("redirect_uri");
    if (clientId !== LINEAR_EMULATOR_FIXTURES.oauthClientId || !redirectUri) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", LINEAR_EMULATOR_OAUTH_CODE);
    const state = c.req.query("state");
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }
    return c.redirect(redirectUrl.toString(), 302);
  });

  app.post("/oauth/token", async (c) => {
    const form = await c.req.parseBody();
    if (!clientCredentialsValid(form.client_id, form.client_secret)) {
      return c.json({ error: "invalid_client" }, 401);
    }

    const grantType = String(form.grant_type ?? "");
    if (grantType === "authorization_code") {
      if (String(form.code ?? "") !== LINEAR_EMULATOR_OAUTH_CODE) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      return c.json(tokenResponse(), 200);
    }

    if (grantType === "refresh_token") {
      const failures = getFailures(store);
      if (
        failures.refresh ||
        String(form.refresh_token ?? "") !==
          LINEAR_EMULATOR_FIXTURES.refreshToken
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      return c.json(tokenResponse(), 200);
    }

    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  app.post("/oauth/revoke", async (c) => {
    const form = await c.req.parseBody();
    if (!clientCredentialsValid(form.client_id, form.client_secret)) {
      return c.json({ error: "invalid_client" }, 401);
    }

    const token = String(form.token ?? "");
    if (
      token === LINEAR_EMULATOR_FIXTURES.accessToken ||
      token === LINEAR_EMULATOR_FIXTURES.refreshToken
    ) {
      return c.body(null, 200);
    }
    return c.json({ error: "invalid_token" }, 400);
  });
}
