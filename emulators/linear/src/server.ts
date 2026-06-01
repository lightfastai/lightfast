import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";

import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_OAUTH_CODE,
  LINEAR_EMULATOR_TOOLS,
} from "./fixtures";

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

export interface StartLinearEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export interface StartedLinearEmulator {
  close(): Promise<void>;
  failures: FailureSwitches;
  listenUrl: string;
  publicOrigin: string;
  reset(): void;
  url: string;
}

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 2_592_000;

function createFailureSwitches(): FailureSwitches {
  return {
    accessTokenExpired: false,
    mcpListTools: false,
    refresh: false,
  };
}

function resetFailureSwitches(failures: FailureSwitches) {
  failures.accessTokenExpired = false;
  failures.mcpListTools = false;
  failures.refresh = false;
}

function formatListenUrl(host: string, port: number) {
  const urlHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const formattedHost = urlHost.includes(":") ? `[${urlHost}]` : urlHost;
  return `http://${formattedHost}:${port}`;
}

function waitForListening(httpServer: Server) {
  if (httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
  });
}

function closeServer(httpServer: Server) {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function emptyResponse(res: ServerResponse, status: number) {
  res.writeHead(status);
  res.end();
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

function getBearerToken(req: IncomingMessage) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

function isValidBearer(
  req: IncomingMessage,
  failures: FailureSwitches
) {
  return (
    !failures.accessTokenExpired &&
    getBearerToken(req) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readForm(req: IncomingMessage) {
  return new URLSearchParams(await readBody(req));
}

async function readJson(req: IncomingMessage) {
  const body = await readBody(req);
  if (!body) {
    return null;
  }
  return JSON.parse(body) as unknown;
}

function validateClientCredentials(form: URLSearchParams) {
  return (
    form.get("client_id") === LINEAR_EMULATOR_FIXTURES.oauthClientId &&
    form.get("client_secret") === LINEAR_EMULATOR_FIXTURES.oauthClientSecret
  );
}

function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL
) {
  const clientId = requestUrl.searchParams.get("client_id");
  const redirectUri = requestUrl.searchParams.get("redirect_uri");
  if (!(clientId === LINEAR_EMULATOR_FIXTURES.oauthClientId && redirectUri)) {
    jsonResponse(res, 400, { error: "invalid_request" });
    return;
  }

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", LINEAR_EMULATOR_OAUTH_CODE);
  const state = requestUrl.searchParams.get("state");
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  res.writeHead(302, { location: redirectUrl.toString() });
  res.end();
}

async function handleToken(
  req: IncomingMessage,
  res: ServerResponse,
  failures: FailureSwitches
) {
  const form = await readForm(req);
  if (!validateClientCredentials(form)) {
    jsonResponse(res, 401, { error: "invalid_client" });
    return;
  }

  const grantType = form.get("grant_type");
  if (grantType === "authorization_code") {
    if (form.get("code") !== LINEAR_EMULATOR_OAUTH_CODE) {
      jsonResponse(res, 400, { error: "invalid_grant" });
      return;
    }
    jsonResponse(res, 200, tokenResponse());
    return;
  }

  if (grantType === "refresh_token") {
    if (
      failures.refresh ||
      form.get("refresh_token") !== LINEAR_EMULATOR_FIXTURES.refreshToken
    ) {
      jsonResponse(res, 400, { error: "invalid_grant" });
      return;
    }
    jsonResponse(res, 200, tokenResponse());
    return;
  }

  jsonResponse(res, 400, { error: "unsupported_grant_type" });
}

async function handleRevoke(
  req: IncomingMessage,
  res: ServerResponse
) {
  const form = await readForm(req);
  if (!validateClientCredentials(form)) {
    jsonResponse(res, 401, { error: "invalid_client" });
    return;
  }

  const token = form.get("token");
  if (
    token === LINEAR_EMULATOR_FIXTURES.accessToken ||
    token === LINEAR_EMULATOR_FIXTURES.refreshToken
  ) {
    emptyResponse(res, 200);
    return;
  }

  jsonResponse(res, 400, { error: "invalid_token" });
}

async function handleFailures(
  req: IncomingMessage,
  res: ServerResponse,
  failures: FailureSwitches
) {
  const body = await readJson(req);
  if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
    jsonResponse(res, 400, { error: "invalid_failure_switches" });
    return;
  }

  const switches = body as Partial<Record<keyof FailureSwitches, unknown>> | null;
  for (const name of failureSwitchNames) {
    const value = switches?.[name];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "boolean") {
      jsonResponse(res, 400, {
        error: "invalid_failure_switch",
        field: name,
      });
      return;
    }
    failures[name] = value;
  }

  jsonResponse(res, 200, { failures });
}

async function handleMcp(
  req: IncomingMessage,
  res: ServerResponse,
  failures: FailureSwitches
) {
  if (!isValidBearer(req, failures)) {
    jsonResponse(res, 401, { error: "invalid_token" });
    return;
  }

  const body = (await readJson(req)) as
    | {
        id?: number | string | null;
        method?: string;
        params?: { name?: string; arguments?: unknown };
      }
    | null;
  if (!body || !body.method) {
    jsonResponse(res, 400, { error: "invalid_request" });
    return;
  }

  if (body.id === undefined || body.id === null) {
    emptyResponse(res, 202);
    return;
  }

  if (body.method === "initialize") {
    jsonResponse(res, 200, {
      id: body.id,
      jsonrpc: "2.0",
      result: {
        capabilities: { tools: {} },
        protocolVersion: "2025-06-18",
        serverInfo: { name: "linear-emulator", version: "0.1.0" },
      },
    });
    return;
  }

  if (body.method === "tools/list") {
    if (failures.mcpListTools) {
      jsonResponse(res, 500, {
        error: { code: -32_003, message: "Linear MCP list-tools failure" },
        id: body.id,
        jsonrpc: "2.0",
      });
      return;
    }
    jsonResponse(res, 200, {
      id: body.id,
      jsonrpc: "2.0",
      result: { tools: LINEAR_EMULATOR_TOOLS },
    });
    return;
  }

  if (body.method === "tools/call") {
    const name = body.params?.name;
    const tool = LINEAR_EMULATOR_TOOLS.find((item) => item.name === name);
    if (!tool) {
      jsonResponse(res, 200, {
        error: { code: -32_602, message: `Unknown tool: ${name ?? ""}` },
        id: body.id,
        jsonrpc: "2.0",
      });
      return;
    }

    const structuredContent = {
      arguments: body.params?.arguments ?? {},
      ok: true,
      tool: tool.name,
    };
    jsonResponse(res, 200, {
      id: body.id,
      jsonrpc: "2.0",
      result: {
        content: [
          { type: "text", text: JSON.stringify(structuredContent, null, 2) },
        ],
        structuredContent,
      },
    });
    return;
  }

  jsonResponse(res, 200, {
    error: { code: -32_601, message: `Unsupported method: ${body.method}` },
    id: body.id,
    jsonrpc: "2.0",
  });
}

export async function startLinearEmulator(
  input: StartLinearEmulatorInput = {}
): Promise<StartedLinearEmulator> {
  const host = input.host ?? "127.0.0.1";
  const port = input.port ?? 4568;
  const failures = createFailureSwitches();

  const httpServer = createServer((req, res) => {
    void (async () => {
      const listenAddress = httpServer.address();
      const listenPort =
        typeof listenAddress === "object" && listenAddress
          ? listenAddress.port
          : port;
      const requestUrl = new URL(
        req.url ?? "/",
        input.publicOrigin ?? formatListenUrl(host, listenPort)
      );

      if (req.method === "GET" && requestUrl.pathname === "/oauth/authorize") {
        handleAuthorize(req, res, requestUrl);
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/oauth/token") {
        await handleToken(req, res, failures);
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/oauth/revoke") {
        await handleRevoke(req, res);
        return;
      }
      if (req.method === "GET" && requestUrl.pathname === "/viewer") {
        if (!isValidBearer(req, failures)) {
          jsonResponse(res, 401, { error: "invalid_token" });
          return;
        }
        jsonResponse(res, 200, viewerResponse());
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/graphql") {
        if (!isValidBearer(req, failures)) {
          jsonResponse(res, 401, { error: "invalid_token" });
          return;
        }
        await readBody(req);
        jsonResponse(res, 200, viewerResponse());
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/mcp") {
        await handleMcp(req, res, failures);
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/failures") {
        await handleFailures(req, res, failures);
        return;
      }
      if (req.method === "POST" && requestUrl.pathname === "/reset") {
        resetFailureSwitches(failures);
        jsonResponse(res, 200, { failures });
        return;
      }

      jsonResponse(res, 404, { error: "not_found" });
    })().catch((error: unknown) => {
      jsonResponse(res, 500, {
        error: error instanceof Error ? error.message : "internal_error",
      });
    });
  });

  httpServer.listen(port, host);
  await waitForListening(httpServer).catch(async (error: unknown) => {
    await closeServer(httpServer).catch(() => undefined);
    throw error;
  });

  const address = httpServer.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : port;
  const listenUrl = formatListenUrl(host, resolvedPort);
  const publicOrigin = input.publicOrigin ?? listenUrl;
  let closed = false;

  return {
    async close() {
      if (closed) {
        return;
      }
      closed = true;
      await closeServer(httpServer);
    },
    failures,
    listenUrl,
    publicOrigin,
    reset() {
      resetFailureSwitches(failures);
    },
    url: listenUrl,
  };
}
