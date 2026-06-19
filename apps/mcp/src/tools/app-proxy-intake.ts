import {
  type McpProviderRoutineCallCommandInput,
  type McpProviderRoutineFindCommandInput,
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@lightfast/connector-core/provider-routines";
import { signServiceJWT } from "@repo/service-jwt";

import { env } from "../env";

type Fetch = typeof fetch;

interface ProviderRoutineProxyContext {
  actor: {
    orgId: string;
    userId: string;
  };
  scopes: {
    providerRoutineRead: boolean;
    providerRoutineWrite: boolean;
  };
  source: {
    clientId?: string | null;
    ref?: string | null;
    surface: string;
  };
}

export class AppProxyIntakeError extends Error {
  readonly code: string;
  readonly providerRoutineCallId?: string;
  readonly routineId?: string;
  readonly status: number;

  constructor(
    message: string,
    options: ErrorOptions & {
      code?: string;
      providerRoutineCallId?: string;
      routineId?: string;
      status?: number;
    } = {}
  ) {
    super(message, options);
    this.code = options.code ?? "app_proxy_intake_failed";
    this.name = "AppProxyIntakeError";
    this.providerRoutineCallId = options.providerRoutineCallId;
    this.routineId = options.routineId;
    this.status = options.status ?? 502;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appProxyUrl(pathname: string): string {
  return new URL(pathname, env.MCP_AUTH_ISSUER).toString();
}

function commandActorFromContext(
  context: ProviderRoutineProxyContext
): McpProviderRoutineFindCommandInput["actor"] {
  return {
    clientId: context.source.clientId ?? "",
    grantId: context.source.ref ?? "",
    kind: "mcp",
    orgId: context.actor.orgId,
    userId: context.actor.userId,
  };
}

function messageFromBody(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return "App proxy command failed.";
}

function stringField(body: unknown, field: string): string | undefined {
  if (
    body &&
    typeof body === "object" &&
    field in body &&
    typeof (body as Record<string, unknown>)[field] === "string"
  ) {
    return (body as Record<string, string>)[field];
  }
  return;
}

function errorCodeFromBody(responseStatus: number, body: unknown): string {
  const code = stringField(body, "error");
  if (code) {
    return code;
  }
  if (responseStatus === 401 || responseStatus === 403) {
    return "org_access_denied";
  }
  return "app_proxy_intake_failed";
}

function mappedErrorStatus(responseStatus: number): number {
  if ([400, 401, 403, 404].includes(responseStatus)) {
    return responseStatus;
  }
  return 502;
}

async function postAppProxyCommand(input: {
  body: unknown;
  fetch?: Fetch;
  pathname: string;
}): Promise<unknown> {
  const serviceToken = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: env.SERVICE_JWT_SECRET,
  });
  const requestFetch = input.fetch ?? fetch;
  const response = await requestFetch(appProxyUrl(input.pathname), {
    body: JSON.stringify(input.body),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppProxyIntakeError(messageFromBody(responseBody), {
      code: errorCodeFromBody(response.status, responseBody),
      providerRoutineCallId: stringField(responseBody, "providerRoutineCallId"),
      routineId: stringField(responseBody, "routineId"),
      status: mappedErrorStatus(response.status),
    });
  }

  return responseBody;
}

export async function findProviderRoutinesViaApp(
  context: ProviderRoutineProxyContext,
  input: ProviderRoutineFindInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<ProviderRoutineFindOutput> {
  const body: McpProviderRoutineFindCommandInput =
    mcpProviderRoutineFindCommandInputSchema.parse({
      actor: commandActorFromContext(context),
      input,
      scopes: context.scopes,
    });
  const responseBody = await postAppProxyCommand({
    body,
    fetch: dependencies.fetch,
    pathname: "/api/internal/mcp/proxy/find",
  });

  try {
    return providerRoutineFindOutputSchema.parse(responseBody);
  } catch (error) {
    throw new AppProxyIntakeError("App proxy find response was invalid.", {
      cause: error,
    });
  }
}

export async function callProviderRoutineViaApp(
  context: ProviderRoutineProxyContext,
  input: ProviderRoutineCallInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<ProviderRoutineCallSuccess> {
  const body: McpProviderRoutineCallCommandInput =
    mcpProviderRoutineCallCommandInputSchema.parse({
      actor: commandActorFromContext(context),
      input,
      scopes: context.scopes,
    });
  const responseBody = await postAppProxyCommand({
    body,
    fetch: dependencies.fetch,
    pathname: "/api/internal/mcp/proxy/call",
  });

  try {
    return providerRoutineCallSuccessSchema.parse(responseBody);
  } catch (error) {
    throw new AppProxyIntakeError("App proxy call response was invalid.", {
      cause: error,
    });
  }
}
