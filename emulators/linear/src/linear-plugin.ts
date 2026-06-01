import type { Context, ServicePlugin, Store } from "@emulators/core";

import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_OAUTH_CODE,
  LINEAR_EMULATOR_TOOLS,
} from "./fixtures";

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 2_592_000;

interface FailureSwitches {
  accessTokenExpired: boolean;
  mcpListTools: boolean;
  refresh: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "mcpListTools",
  "refresh",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, mcpListTools: false, refresh: false };
}

function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

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

function viewerResponse() {
  return {
    data: {
      viewer: {
        id: LINEAR_EMULATOR_FIXTURES.actorId,
        name: LINEAR_EMULATOR_FIXTURES.actorName,
        organization: {
          id: LINEAR_EMULATOR_FIXTURES.workspaceId,
          name: LINEAR_EMULATOR_FIXTURES.workspaceName,
        },
      },
    },
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

function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
}

export const linearPlugin: ServicePlugin = {
  name: "linear",
  register(app, store) {
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

    app.get("/viewer", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }
      return c.json(viewerResponse(), 200);
    });

    app.post("/graphql", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }
      return c.json(viewerResponse(), 200);
    });

    app.post("/mcp", async (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }

      const body = (await c.req
        .json()
        .catch(() => null)) as McpRequestBody | null;
      if (!body?.method) {
        return c.json({ error: "invalid_request" }, 400);
      }

      if (body.id === undefined || body.id === null) {
        return c.body(null, 202);
      }

      if (body.method === "initialize") {
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: {
              capabilities: { tools: {} },
              protocolVersion: "2025-06-18",
              serverInfo: { name: "linear-emulator", version: "0.1.0" },
            },
          },
          200
        );
      }

      if (body.method === "tools/list") {
        if (getFailures(store).mcpListTools) {
          return c.json(
            {
              error: {
                code: -32_003,
                message: "Linear MCP list-tools failure",
              },
              id: body.id,
              jsonrpc: "2.0",
            },
            500
          );
        }
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: { tools: LINEAR_EMULATOR_TOOLS },
          },
          200
        );
      }

      if (body.method === "tools/call") {
        const name = body.params?.name;
        const tool = LINEAR_EMULATOR_TOOLS.find((item) => item.name === name);
        if (!tool) {
          return c.json(
            {
              error: { code: -32_602, message: `Unknown tool: ${name ?? ""}` },
              id: body.id,
              jsonrpc: "2.0",
            },
            200
          );
        }

        const structuredContent = {
          arguments: body.params?.arguments ?? {},
          ok: true,
          tool: tool.name,
        };
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(structuredContent, null, 2),
                },
              ],
              structuredContent,
            },
          },
          200
        );
      }

      return c.json(
        {
          error: {
            code: -32_601,
            message: `Unsupported method: ${body.method}`,
          },
          id: body.id,
          jsonrpc: "2.0",
        },
        200
      );
    });

    app.post("/failures", async (c) => {
      const body = (await c.req.json().catch(() => null)) as Partial<
        Record<keyof FailureSwitches, unknown>
      > | null;
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
  },
};
