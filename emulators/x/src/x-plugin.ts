import { createHash } from "node:crypto";

import type { Context, Entity, ServicePlugin, Store } from "@emulators/core";

import {
  X_EMULATOR_FIXTURES,
  X_EMULATOR_OAUTH_CODE,
  X_EMULATOR_SCOPE,
} from "./fixtures";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 7200;

interface FailureSwitches {
  accessTokenExpired: boolean;
  refresh: boolean;
  usersMe: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "refresh",
  "usersMe",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

interface XUserRow extends Entity {
  x_id: string;
  name: string;
  username: string;
}

function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, refresh: false, usersMe: false };
}

function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

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

function userResponse(store: Store) {
  const user = store.collection<XUserRow>("users").all()[0];
  return {
    data: {
      id: user?.x_id ?? X_EMULATOR_FIXTURES.userId,
      name: user?.name ?? X_EMULATOR_FIXTURES.userName,
      username: user?.username ?? X_EMULATOR_FIXTURES.username,
    },
  };
}

function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  return authorization.slice("Bearer ".length);
}

function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === X_EMULATOR_FIXTURES.accessToken
  );
}

export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store) {
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

    app.get("/2/users/me", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ title: "Unauthorized", status: 401 }, 401);
      }
      if (getFailures(store).usersMe) {
        return c.json({ title: "Internal Error", status: 500 }, 500);
      }
      return c.json(userResponse(store), 200);
    });

    app.post("/failures", async (c) => {
      const body = (await c.req.json().catch(() => null)) as
        | Partial<Record<keyof FailureSwitches, unknown>>
        | null;
      if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
        return c.json({ error: "invalid_failure_switches" }, 400);
      }

      const failures = getFailures(store);
      for (const name of failureSwitchNames) {
        const value = body?.[name];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== "boolean") {
          return c.json({ error: "invalid_failure_switch", field: name }, 400);
        }
        failures[name] = value;
      }
      store.setData("failures", failures);
      return c.json({ failures }, 200);
    });

    app.post("/reset", (c) => {
      const failures = defaultFailures();
      store.setData("failures", failures);
      return c.json({ failures }, 200);
    });
  },
  seed(store) {
    store.setData("failures", defaultFailures());
    store.collection<XUserRow>("users").insert({
      x_id: X_EMULATOR_FIXTURES.userId,
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
    });
  },
};
