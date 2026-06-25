import {
  type DecisionFindInput,
  type DecisionFindOutput,
  type DecisionGetInput,
  type DecisionGetOutput,
  decisionFindOutputSchema,
  decisionGetOutputSchema,
  type McpDecisionFindCommandInput,
  type McpDecisionGetCommandInput,
  type McpDecisionScope,
  mcpDecisionFindCommandInputSchema,
  mcpDecisionGetCommandInputSchema,
} from "@repo/api-contract";
import { signServiceJWT } from "@repo/service-jwt";

import { appInternalUrl, env } from "../env";

type Fetch = typeof fetch;

interface DecisionMcpContext {
  actor: {
    orgId: string;
    scopes: readonly McpDecisionScope[];
    userId: string;
  };
  scopes: {
    decisionRead: boolean;
  };
  source: {
    clientId?: string | null;
    ref?: string | null;
    surface: string;
  };
}

export class AppDecisionIntakeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    options: ErrorOptions & { code?: string; status?: number } = {}
  ) {
    super(message, options);
    this.code = options.code ?? "app_decision_intake_failed";
    this.name = "AppDecisionIntakeError";
    this.status = options.status ?? 502;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appDecisionUrl(pathname: string): string {
  return new URL(pathname, appInternalUrl).toString();
}

function commandActorFromContext(
  context: DecisionMcpContext
): McpDecisionFindCommandInput["actor"] {
  return {
    clientId: context.source.clientId ?? "",
    grantId: context.source.ref ?? "",
    kind: "mcp",
    orgId: context.actor.orgId,
    scopes: [...context.actor.scopes],
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
  return "App decision intake command failed.";
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
  if (responseStatus === 404) {
    return "not_found";
  }
  return "app_decision_intake_failed";
}

function mappedErrorStatus(responseStatus: number): number {
  if ([400, 401, 403, 404].includes(responseStatus)) {
    return responseStatus;
  }
  return 502;
}

async function postAppDecisionCommand(input: {
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
  const response = await requestFetch(appDecisionUrl(input.pathname), {
    body: JSON.stringify(input.body),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppDecisionIntakeError(messageFromBody(responseBody), {
      code: errorCodeFromBody(response.status, responseBody),
      status: mappedErrorStatus(response.status),
    });
  }

  return responseBody;
}

export async function findDecisionsViaApp(
  context: DecisionMcpContext,
  input: DecisionFindInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<DecisionFindOutput> {
  const body: McpDecisionFindCommandInput =
    mcpDecisionFindCommandInputSchema.parse({
      actor: commandActorFromContext(context),
      input,
      scopes: context.scopes,
    });
  const responseBody = await postAppDecisionCommand({
    body,
    fetch: dependencies.fetch,
    pathname: "/api/internal/mcp/decisions/find",
  });

  try {
    return decisionFindOutputSchema.parse(responseBody);
  } catch (error) {
    throw new AppDecisionIntakeError(
      "App decision find response was invalid.",
      {
        cause: error,
      }
    );
  }
}

export async function getDecisionViaApp(
  context: DecisionMcpContext,
  input: DecisionGetInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<DecisionGetOutput | undefined> {
  const body: McpDecisionGetCommandInput =
    mcpDecisionGetCommandInputSchema.parse({
      actor: commandActorFromContext(context),
      input,
      scopes: context.scopes,
    });

  let responseBody: unknown;
  try {
    responseBody = await postAppDecisionCommand({
      body,
      fetch: dependencies.fetch,
      pathname: "/api/internal/mcp/decisions/get",
    });
  } catch (error) {
    if (
      error instanceof AppDecisionIntakeError &&
      error.code === "not_found" &&
      error.status === 404
    ) {
      return;
    }
    throw error;
  }

  try {
    return decisionGetOutputSchema.parse(responseBody);
  } catch (error) {
    throw new AppDecisionIntakeError("App decision get response was invalid.", {
      cause: error,
    });
  }
}
