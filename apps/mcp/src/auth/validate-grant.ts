import { signServiceJWT } from "@repo/service-jwt";
import { appInternalUrl, env } from "../env";

type Fetch = typeof fetch;

const GRANT_VALIDATION_TIMEOUT_MS = 2000;

interface ValidateMcpGrantInput {
  clientId: string;
  grantId: string;
  orgId: string;
  resource: string;
  userId: string;
}

class McpGrantInvalidError extends Error {
  constructor() {
    super("MCP authorization grant is invalid.");
    this.name = "McpGrantInvalidError";
  }
}

export class McpGrantValidationUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "McpGrantValidationUnavailableError";
  }
}

function validationUrl(): string {
  return new URL("/api/internal/mcp/auth/validate", appInternalUrl).toString();
}

function validationAbortSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(GRANT_VALIDATION_TIMEOUT_MS)
    : undefined;
}

function warnValidationUnavailable(message: string, cause?: unknown): void {
  console.warn("[mcp-auth] Grant liveness validation unavailable", {
    cause,
    message,
  });
}

function grantValidationUnavailable(message: string, cause?: unknown): never {
  warnValidationUnavailable(message, cause);
  throw new McpGrantValidationUnavailableError(
    "MCP authorization grant validation is temporarily unavailable.",
    { cause }
  );
}

export async function validateMcpGrantViaApp(
  input: ValidateMcpGrantInput,
  dependencies: { fetch?: Fetch } = {}
): Promise<void> {
  const serviceToken = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: env.SERVICE_JWT_SECRET,
  });
  const requestFetch = dependencies.fetch ?? fetch;
  let response: Response;
  try {
    response = await requestFetch(validationUrl(), {
      body: JSON.stringify(input),
      headers: {
        authorization: `Bearer ${serviceToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: validationAbortSignal(),
    });
  } catch (error) {
    grantValidationUnavailable("request_failed", error);
  }

  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 403) {
      throw new McpGrantInvalidError();
    }
    if (
      response.status === 401 ||
      response.status === 404 ||
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      grantValidationUnavailable(`unexpected_status_${response.status}`);
    }
    throw new McpGrantInvalidError();
  }

  const body = await response.json().catch(() => undefined);
  if (
    !body ||
    typeof body !== "object" ||
    (body as { active?: unknown }).active !== true
  ) {
    throw new McpGrantInvalidError();
  }
}
