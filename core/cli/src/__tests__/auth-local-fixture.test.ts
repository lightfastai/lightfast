import { createHash } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { expect, it } from "vitest";
import { createLightfastAppClient } from "../auth/app-client";
import { login } from "../auth/login-flow";
import { getValidAccessToken } from "../auth/session";
import { SessionStore } from "../auth/store";
import { createProgram } from "../program";

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
  }
  return body;
}

it("logs in, refreshes, identifies and logs out against local HTTP fixtures", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lightfast-auth-fixture-"));
  const authPath = join(directory, "auth.json");
  const store = new SessionStore(authPath);
  const requests: string[] = [];
  const fixtureErrors: unknown[] = [];
  let appUrl = "";
  let challenge = "";
  let redirectUri = "";
  let callbackState = "";
  const attemptId = "fixture_attempt_123456789";
  const config = () => ({
    authorizationEndpoint: `${appUrl}/authorize`,
    client: "cli" as const,
    clientId: "fixture_cli",
    issuer: appUrl,
    scopes: ["openid", "profile", "email", "offline_access"],
    supportsDynamicLoopbackPort: true as const,
    tokenEndpoint: `${appUrl}/token`,
  });
  const server = createServer(async (request, response) => {
    requests.push(`${request.method} ${request.url}`);
    response.setHeader("content-type", "application/json");
    try {
      if (request.url === "/api/oauth/cli/config") {
        response.end(JSON.stringify(config()));
      } else if (request.url === "/token") {
        expect(request.method).toBe("POST");
        expect(request.headers["content-type"]).toBe(
          "application/x-www-form-urlencoded"
        );
        const body = new URLSearchParams(await readBody(request));
        expect(body.get("client_id")).toBe("fixture_cli");
        if (body.get("grant_type") === "authorization_code") {
          expect(body.get("code")).toBe("fixture_code");
          expect(body.get("redirect_uri")).toBe(redirectUri);
          const verifier = body.get("code_verifier") ?? "";
          expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
          expect(
            createHash("sha256").update(verifier).digest("base64url")
          ).toBe(challenge);
          response.end(
            JSON.stringify({
              access_token: "fixture_access",
              refresh_token: "fixture_refresh",
              expires_in: 1,
              token_type: "Bearer",
            })
          );
        } else {
          expect(body.get("grant_type")).toBe("refresh_token");
          expect(body.get("refresh_token")).toBe("fixture_refresh");
          response.end(
            JSON.stringify({
              access_token: "fixture_refreshed",
              expires_in: 3600,
              token_type: "bearer",
            })
          );
        }
      } else if (request.url === "/api/oauth/finalize") {
        expect(request.method).toBe("POST");
        expect(request.headers.authorization).toBe("Bearer fixture_access");
        expect(JSON.parse(await readBody(request))).toEqual({
          attemptId,
          client: "cli",
          state: callbackState,
        });
        response.end(
          JSON.stringify({
            client: "cli",
            organization: {
              id: "org_fixture",
              name: "Fixture",
              slug: "fixture",
            },
            user: { id: "user_fixture", email: "fixture@example.test" },
          })
        );
      } else {
        response.writeHead(404).end("{}");
      }
    } catch (error) {
      fixtureErrors.push(error);
      response.writeHead(500).end("{}");
    }
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Fixture server did not bind");
    }
    appUrl = `http://127.0.0.1:${address.port}`;
    let output = "";
    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const run = (command: string) =>
      createProgram({
        stdout,
        store,
        login: () =>
          login({
            deps: {
              getAppUrl: () => appUrl,
              store,
              async openBrowser(startUrl) {
                const start = new URL(startUrl);
                expect(start.origin).toBe(appUrl);
                expect(start.pathname).toBe("/oauth/cli/start");
                expect(start.searchParams.get("code_challenge_method")).toBe(
                  "S256"
                );
                challenge = start.searchParams.get("code_challenge") ?? "";
                expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
                const nonce = start.searchParams.get("state");
                expect(nonce).toMatch(/^[A-Za-z0-9_-]{43,}$/);
                redirectUri = start.searchParams.get("redirect_uri") ?? "";
                const callback = new URL(redirectUri);
                expect(callback.hostname).toBe("127.0.0.1");
                expect(callback.pathname).toBe("/callback");
                callbackState = Buffer.from(
                  JSON.stringify({ attemptId, nonce })
                ).toString("base64url");
                callback.searchParams.set("state", callbackState);
                callback.searchParams.set("code", "fixture_code");
                const response = await fetch(callback);
                expect(response.status).toBe(200);
                expect(await response.text()).toContain("Lightfast CLI");
              },
            },
          }),
      }).parseAsync(["node", "lightfast", command]);
    await run("login");
    expect(output).toBe(
      "Logged in as fixture@example.test for Fixture (fixture).\n"
    );
    expect((await stat(authPath)).mode & 0o777).toBe(0o600);
    const session = await store.get();
    expect(session).toMatchObject({
      appUrl,
      client: "cli",
      schemaVersion: 2,
      oauth: { clientId: "fixture_cli", issuer: appUrl },
      tokens: {
        accessToken: "fixture_access",
        refreshToken: "fixture_refresh",
        tokenType: "Bearer",
      },
    });
    const beforeWhoami = requests.length;
    await run("whoami");
    expect(requests).toHaveLength(beforeWhoami);
    expect(output).toContain(
      `User: fixture@example.test\nOrganization: Fixture (fixture)\nApp: ${appUrl}\n`
    );
    const client = createLightfastAppClient({ appUrl });
    expect(
      await getValidAccessToken({
        appUrl,
        config: await client.getOAuthConfig(),
        store,
      })
    ).toBe("fixture_refreshed");
    expect((await store.get())?.tokens).toMatchObject({
      accessToken: "fixture_refreshed",
      refreshToken: "fixture_refresh",
      tokenType: "Bearer",
    });
    await run("logout");
    expect(output).toContain("Logged out of Lightfast.\n");
    expect(await store.get()).toBeNull();
    await expect(run("whoami")).rejects.toMatchObject({
      code: "NOT_LOGGED_IN",
      message: "Not signed in. Run `lightfast login`.",
    });
    expect(requests).toEqual([
      "GET /api/oauth/cli/config",
      "POST /token",
      "POST /api/oauth/finalize",
      "GET /api/oauth/cli/config",
      "POST /token",
    ]);
    expect(fixtureErrors).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await rm(directory, { recursive: true, force: true });
  }
});
