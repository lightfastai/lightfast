import { db } from "@db/app/client";
import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@lightfast/connector-core/provider-routines";
import type { ProviderRoutineServiceContext } from "@repo/provider-routines";
import { z } from "zod";

const log = {
  error: (message: string, metadata?: Record<string, unknown>) =>
    console.error(message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) =>
    console.info(message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    console.warn(message, metadata),
};

type NativeProviderRoutineServiceContext = ProviderRoutineServiceContext;

type NativeFindProviderRoutines = (
  context: NativeProviderRoutineServiceContext,
  input: ProviderRoutineFindInput
) => Promise<ProviderRoutineFindOutput>;

type NativeCallProviderRoutine = (
  context: NativeProviderRoutineServiceContext,
  input: ProviderRoutineCallInput
) => Promise<ProviderRoutineCallSuccess>;

interface NativeProviderRoutineServices {
  callProviderRoutine: NativeCallProviderRoutine;
  findProviderRoutines: NativeFindProviderRoutines;
}

class NativeProxyRouteError extends Error {
  constructor(
    readonly code: "BAD_REQUEST" | "FORBIDDEN" | "UNAUTHORIZED",
    message: string,
    readonly status: number,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "NativeProxyRouteError";
  }
}

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

function errorResponse(error: unknown) {
  const normalized = normalizeRouteError(error);
  return jsonResponse(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
      },
    },
    { status: normalized.status }
  );
}

async function createNativeProviderRoutineContext(
  req: Request
): Promise<NativeProviderRoutineServiceContext> {
  const { resolveAuthContextFromClerk } = await import(
    "@api/app/auth/identity"
  );
  const { loadAgentConnectorRuntimeTools } = await import(
    "@api/app/services/connectors/runtime"
  );
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: req.headers,
  });
  const access = auth.access;
  const identity = auth.identity;
  if (access?.kind !== "clerk-oauth" || access.client !== "cli") {
    throw new NativeProxyRouteError(
      "UNAUTHORIZED",
      "Lightfast native CLI OAuth authentication required.",
      401
    );
  }
  if (identity.type !== "active") {
    throw new NativeProxyRouteError(
      "FORBIDDEN",
      "Lightfast native CLI organization binding required.",
      403
    );
  }

  return {
    actor: {
      orgId: identity.orgId,
      userId: identity.userId,
    },
    adapters: {
      connectors: {
        loadTools: async () =>
          await loadAgentConnectorRuntimeTools({
            calledByUserId: identity.userId,
            clerkOrgId: identity.orgId,
            sourceClientId: access.clientId,
            sourceRef: identity.orgId,
            sourceSurface: "native_cli",
          }),
      },
    },
    db,
    log,
    now: () => new Date(),
    scopes: {
      providerRoutineRead: true,
      providerRoutineWrite: true,
    },
    source: {
      clientId: access.clientId,
      ref: identity.orgId,
      surface: "native_cli",
    },
  };
}

async function loadNativeProviderRoutineServices() {
  return (await import(
    "@repo/provider-routines"
  )) as NativeProviderRoutineServices;
}

export async function handleNativeProviderRoutineCallRequest(
  request: Request
): Promise<Response> {
  try {
    const input = providerRoutineCallInputSchema.parse(
      await request.json().catch(() => null)
    );
    const context = await createNativeProviderRoutineContext(request);
    const { callProviderRoutine } = await loadNativeProviderRoutineServices();
    const result = await callProviderRoutine(context, input);
    return jsonResponse(providerRoutineCallSuccessSchema.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleNativeProviderRoutineFindRequest(
  request: Request
): Promise<Response> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const input = providerRoutineFindInputSchema.parse({
      includeSchema:
        searchParams.get("includeSchema") === "true" ? true : undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
      provider: searchParams.get("provider") ?? undefined,
      query: searchParams.get("query") ?? undefined,
      readOnly: searchParams.get("readOnly") === "true" ? true : undefined,
      routineId: searchParams.get("routineId") ?? undefined,
    });
    const context = await createNativeProviderRoutineContext(request);
    const { findProviderRoutines } = await loadNativeProviderRoutineServices();
    const result = await findProviderRoutines(context, input);
    return jsonResponse(providerRoutineFindOutputSchema.parse(result));
  } catch (error) {
    return errorResponse(error);
  }
}

function normalizeRouteError(error: unknown): {
  code: string;
  message: string;
  status: number;
} {
  if (error instanceof NativeProxyRouteError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      code: "BAD_REQUEST",
      message: "Native proxy request is invalid.",
      status: 400,
    };
  }
  if (isProviderRoutineError(error)) {
    return {
      code: error.code,
      message: error.publicMessage,
      status: statusFromProviderRoutineError(error.code),
    };
  }

  console.error("[native-proxy] Unexpected route error", error);
  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected native proxy error",
    status: 500,
  };
}

function isProviderRoutineError(
  error: unknown
): error is Error & { code: string; publicMessage: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("PROVIDER_ROUTINE_") &&
    "publicMessage" in error &&
    typeof error.publicMessage === "string"
  );
}

function statusFromProviderRoutineError(code: string) {
  switch (code) {
    case "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE":
      return 403;
    case "PROVIDER_ROUTINE_INVALID_INPUT":
      return 400;
    case "PROVIDER_ROUTINE_CONNECTION_REQUIRED":
    case "PROVIDER_ROUTINE_NOT_ENABLED":
    case "PROVIDER_ROUTINE_NOT_FOUND":
      return 404;
    default:
      return 502;
  }
}
