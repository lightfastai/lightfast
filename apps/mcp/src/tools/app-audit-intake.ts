import { signServiceJWT } from "@api/app/service-jwt";
import { env } from "../env";

type Fetch = typeof fetch;

export type McpAuditOutcome = "denied" | "error" | "success";

export interface AppMcpAuditEventInput {
  clerkOrgId?: string | null;
  clerkUserId?: string | null;
  clientPublicId?: string | null;
  eventName: string;
  grantPublicId?: string | null;
  metadata?: Record<string, unknown> | null;
  outcome: McpAuditOutcome;
}

export class AppAuditIntakeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    options: ErrorOptions & { code?: string; status?: number } = {}
  ) {
    super(message, options);
    this.code = options.code ?? "app_audit_intake_failed";
    this.name = "AppAuditIntakeError";
    this.status = options.status ?? 502;
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appAuditUrl(): string {
  return new URL("/api/internal/mcp/audit", env.MCP_AUTH_ISSUER).toString();
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
  return "App audit intake command failed.";
}

function errorCodeFromBody(responseStatus: number, body: unknown): string {
  if (responseStatus !== 401 && responseStatus !== 403) {
    return "app_audit_intake_failed";
  }
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return "app_audit_intake_failed";
}

function mappedErrorStatus(responseStatus: number): number {
  if (responseStatus === 401 || responseStatus === 403) {
    return responseStatus;
  }
  return 502;
}

export async function recordMcpAuditEventViaApp(
  input: AppMcpAuditEventInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<void> {
  const serviceToken = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: env.SERVICE_JWT_SECRET,
  });
  const requestFetch = dependencies.fetch ?? fetch;
  const response = await requestFetch(appAuditUrl(), {
    body: JSON.stringify(input),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppAuditIntakeError(messageFromBody(responseBody), {
      code: errorCodeFromBody(response.status, responseBody),
      status: mappedErrorStatus(response.status),
    });
  }
}
