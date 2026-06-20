import {
  type CreateSignalOutput,
  createMcpSignalCommandInput,
  createSignalOutput,
  type GetSignalOutput,
  getMcpSignalCommandInput,
  getSignalOutput,
  type McpSignalScope,
} from "@repo/api-contract";
import { signServiceJWT } from "@repo/service-jwt";

import { appInternalUrl, env } from "../env";

type Fetch = typeof fetch;

export class AppSignalIntakeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    options: ErrorOptions & { code?: string; status?: number } = {}
  ) {
    super(message, options);
    this.code = options.code ?? "app_signal_intake_failed";
    this.name = "AppSignalIntakeError";
    this.status = options.status ?? 502;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appSignalUrl(pathname = "/api/internal/mcp/signals"): string {
  return new URL(pathname, appInternalUrl).toString();
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
  return "App signal intake command failed.";
}

function errorCodeFromBody(responseStatus: number, body: unknown): string {
  if (responseStatus !== 401 && responseStatus !== 403) {
    return "app_signal_intake_failed";
  }
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return "app_signal_intake_failed";
}

function mappedErrorStatus(responseStatus: number): number {
  if (responseStatus === 401 || responseStatus === 403) {
    return responseStatus;
  }
  return 502;
}

async function postAppSignalCommand(input: {
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
  const response = await requestFetch(appSignalUrl(input.pathname), {
    body: JSON.stringify(input.body),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppSignalIntakeError(messageFromBody(responseBody), {
      code: errorCodeFromBody(response.status, responseBody),
      status: mappedErrorStatus(response.status),
    });
  }

  return responseBody;
}

export async function createSignalForActorViaApp(
  input: {
    actor: {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };
    input: string;
    scopes: McpSignalScope[];
  },
  dependencies: { fetch?: Fetch } = {}
): Promise<CreateSignalOutput> {
  const body = createMcpSignalCommandInput.parse(input);
  const responseBody = await postAppSignalCommand({
    body,
    fetch: dependencies.fetch,
    pathname: "/api/internal/mcp/signals",
  });

  try {
    return createSignalOutput.parse(responseBody);
  } catch (error) {
    throw new AppSignalIntakeError("App signal intake response was invalid.", {
      cause: error,
    });
  }
}

export async function getSignalForActorViaApp(
  input: {
    actor: {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };
    id: string;
    scopes: McpSignalScope[];
  },
  dependencies: { fetch?: Fetch } = {}
): Promise<GetSignalOutput> {
  const body = getMcpSignalCommandInput.parse(input);
  const responseBody = await postAppSignalCommand({
    body,
    fetch: dependencies.fetch,
    pathname: "/api/internal/mcp/signals/get",
  });

  try {
    return getSignalOutput.parse(responseBody);
  } catch (error) {
    throw new AppSignalIntakeError(
      "App signal intake get response was invalid.",
      {
        cause: error,
      }
    );
  }
}
