import { signServiceJWT } from "@api/app/service-jwt";
import type { Database } from "@db/app";
import {
  type CreateSignalOutput,
  createMcpSignalCommandInput,
  createSignalOutput,
} from "@repo/api-contract";

import { env } from "../env";

type Fetch = typeof fetch;

export class AppSignalIntakeError extends Error {
  readonly code = "app_signal_intake_failed";
  readonly status = 502;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppSignalIntakeError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appSignalUrl(): string {
  return new URL("/api/internal/mcp/signals", env.MCP_AUTH_ISSUER).toString();
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

export async function createSignalForActorViaApp(
  _db: Database,
  input: {
    actor: {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };
    input: string;
  },
  dependencies: { fetch?: Fetch } = {}
): Promise<CreateSignalOutput> {
  const body = createMcpSignalCommandInput.parse(input);
  const serviceToken = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: env.SERVICE_JWT_SECRET,
  });
  const requestFetch = dependencies.fetch ?? fetch;
  const response = await requestFetch(appSignalUrl(), {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppSignalIntakeError(messageFromBody(responseBody));
  }

  try {
    return createSignalOutput.parse(responseBody);
  } catch (error) {
    throw new AppSignalIntakeError("App signal intake response was invalid.", {
      cause: error,
    });
  }
}
