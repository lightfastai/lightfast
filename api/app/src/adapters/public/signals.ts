import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
} from "@db/app";
import { db } from "@db/app/client";
import {
  createSignalInput,
  createSignalOutput,
  getSignalInput,
  getSignalOutput,
} from "@repo/api-contract";
import { repairIdForSetupRequirement } from "@repo/app-setup-contract";

import {
  type ApiKeyAuthResult,
  isApiKeyAuthError,
  resolveApiKeyAuth,
} from "../../auth/api-key";
import { isSignalCreateQueueError } from "../../signals/create-signal";
import { createSignalForActor } from "../../signals/service";

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
    error.orpcCode === "FORBIDDEN" ? "forbidden" : "auth_required",
    error.message,
    error.orpcCode === "FORBIDDEN" ? 403 : 401,
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
    const result = await createSignalForActor(db, {
      actor: {
        apiKeyId: auth.apiKeyId,
        kind: "api_key",
        orgId: auth.identity.orgId,
        userId: auth.identity.userId,
      },
      input: parsed.data.input,
    });
    return jsonResponse(createSignalOutput.parse(result), 202);
  } catch (error) {
    if (isSignalCreateQueueError(error)) {
      return jsonError("signal_enqueue_failed", error.message, 500);
    }
    return jsonError("internal_error", "Failed to create signal.", 500);
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
    const signal = await getVisibleSignalByPublicId(db, {
      clerkOrgId: auth.identity.orgId,
      createdByUserId: auth.identity.userId,
      publicId: parsed.data.id,
    });

    if (!signal) {
      return jsonError("not_found", "Signal not found.", 404);
    }

    const entityLinks = await listSignalEntityLinksForSignal(db, {
      clerkOrgId: auth.identity.orgId,
      signalId: signal.publicId,
    });

    const output = getSignalOutput.parse({
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      entityLinks,
      visibilityScope: signal.visibilityScope,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    });

    return jsonResponse(output, 200);
  } catch (error) {
    if (error instanceof Response) {
      return withPublicApiCors(error);
    }
    return jsonError("internal_error", "Failed to get signal.", 500);
  }
}
