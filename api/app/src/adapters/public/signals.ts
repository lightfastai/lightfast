import { db } from "@db/app/client";
import {
  createSignalInput,
  createSignalOutput,
  getSignalInput,
  getSignalOutput,
} from "@repo/api-contract";
import {
  type OrgSetupRequirement,
  orgSetupRequirementSchema,
  repairIdForSetupRequirement,
} from "@repo/app-setup-contract";

import {
  type ApiKeyAuthResult,
  isApiKeyAuthError,
  resolveApiKeyAuth,
} from "../../auth/api-key";
import { actorFromApiKeyAuth, isDomainError } from "../../domain";
import {
  createSignalCommand,
  createSignalCommandDeps,
  getSignalCommand,
  getSignalCommandDeps,
} from "../../domain/signals";

type PublicApiStatus = 400 | 401 | 403 | 404 | 500;

function withPublicApiCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "authorization,content-type"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function jsonResponse(data: unknown, status: number): Response {
  return withPublicApiCors(Response.json(data, { status }));
}

function jsonError(
  error: string,
  message: string,
  status: PublicApiStatus,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ error, message, ...extra }, status);
}

function authErrorResponse(error: unknown): Response {
  if (!isApiKeyAuthError(error)) {
    return jsonError(
      "internal_error",
      "Failed to authenticate API request.",
      500
    );
  }

  return jsonError(
    error.status === 403 ? "forbidden" : "auth_required",
    error.message,
    error.status,
    { diagnostics: [error.diagnostic] }
  );
}

function orgSetupErrorResponse(auth: ApiKeyAuthResult): Response {
  const requirement = auth.identity.orgGate.nextSetupRequirement;
  const message =
    "This organization has not completed setup. Complete setup before using Lightfast API features.";
  return jsonError("org_setup_required", message, 403, {
    diagnostics: [
      {
        code: "ORG_SETUP_REQUIRED",
        message,
        repair: {
          id: repairIdForSetupRequirement(requirement ?? "github_org"),
        },
      },
    ],
  });
}

function requestId() {
  return crypto.randomUUID();
}

function publicSignalContext(auth: ApiKeyAuthResult) {
  return {
    actor: actorFromApiKeyAuth(auth, ["api:signals:read", "api:signals:write"]),
    request: { id: requestId(), source: "public-api" as const },
  };
}

function setupRequirementOrDefault(requirement: unknown): OrgSetupRequirement {
  const parsed = orgSetupRequirementSchema.safeParse(requirement);
  return parsed.success ? parsed.data : "github_org";
}

function domainErrorResponse(
  error: unknown,
  fallbackMessage: string
): Response {
  if (!isDomainError(error)) {
    return jsonError("internal_error", fallbackMessage, 500);
  }

  if (error.code === "SIGNAL_NOT_FOUND") {
    return jsonError("not_found", "Signal not found.", 404);
  }

  if (error.code === "SIGNAL_QUEUE_FAILED") {
    return jsonError("signal_enqueue_failed", error.message, 500);
  }

  if (error.code === "ORG_SETUP_REQUIRED") {
    return jsonError("org_setup_required", error.message, 403, {
      diagnostics: [
        {
          code: error.code,
          message: error.message,
          repair: {
            id: repairIdForSetupRequirement(
              setupRequirementOrDefault(error.details.nextSetupRequirement)
            ),
          },
        },
      ],
    });
  }

  if (error.kind === "authz") {
    return jsonError("forbidden", error.message, 403, {
      diagnostics: [{ code: error.code, message: error.message }],
    });
  }

  if (error.kind === "validation") {
    return jsonError("invalid_request", error.message, 400, {
      diagnostics: error.details.issues,
    });
  }

  return jsonError("internal_error", fallbackMessage, 500);
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

async function requireBoundApiKeyAuth(
  request: Request
): Promise<ApiKeyAuthResult | Response> {
  let auth: ApiKeyAuthResult;
  try {
    auth = await resolveApiKeyAuth({ db, headers: request.headers });
  } catch (error) {
    return authErrorResponse(error);
  }

  if (auth.identity.orgGate.bindingStatus !== "bound") {
    return orgSetupErrorResponse(auth);
  }

  return auth;
}

export function handlePublicApiOptionsRequest(): Response {
  return withPublicApiCors(new Response(null, { status: 204 }));
}

export async function handleCreateSignalPublicApiRequest(
  request: Request
): Promise<Response> {
  const auth = await requireBoundApiKeyAuth(request);
  if (isResponse(auth)) {
    return auth;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createSignalInput.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "Signal request body is invalid.",
      400,
      {
        diagnostics: parsed.error.issues,
      }
    );
  }

  try {
    const result = await createSignalCommand.run({
      ctx: publicSignalContext(auth),
      deps: createSignalCommandDeps({ db }),
      input: parsed.data,
    });
    return jsonResponse(createSignalOutput.parse(result), 202);
  } catch (error) {
    return domainErrorResponse(error, "Failed to create signal.");
  }
}

export async function handleGetSignalPublicApiRequest(
  request: Request,
  params: { id: string }
): Promise<Response> {
  const auth = await requireBoundApiKeyAuth(request);
  if (isResponse(auth)) {
    return auth;
  }

  const parsed = getSignalInput.safeParse(params);
  if (!parsed.success) {
    return jsonError("invalid_request", "Signal id is invalid.", 400, {
      diagnostics: parsed.error.issues,
    });
  }

  try {
    const signal = await getSignalCommand.run({
      ctx: publicSignalContext(auth),
      deps: getSignalCommandDeps({ db }),
      input: { publicId: parsed.data.id },
    });

    const output = getSignalOutput.parse({
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      entityLinks: signal.entityLinks,
      visibilityScope: signal.visibilityScope,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    });

    return jsonResponse(output, 200);
  } catch (error) {
    return domainErrorResponse(error, "Failed to get signal.");
  }
}
