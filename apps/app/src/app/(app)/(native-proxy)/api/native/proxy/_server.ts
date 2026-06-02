import { resolveAuthContextFromClerk } from "@api/app/auth/identity";
import type { Database } from "@db/app";
import { db } from "@db/app/client";
import type {
  ProviderRoutineCallInput,
  ProviderRoutineCallSuccess,
  ProviderRoutineFindInput,
  ProviderRoutineFindOutput,
  ProviderRoutineSourceSurface,
} from "@repo/provider-routine-contract";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";

const PROVIDER_ROUTINES_PACKAGE: string = "@repo/provider-routines";

export interface NativeProviderRoutineServiceContext {
  actor: {
    orgId: string;
    userId: string;
  };
  db: Database;
  log: {
    error(message: string, metadata?: Record<string, unknown>): void;
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
  };
  now: () => Date;
  scopes: {
    providerRoutineRead: boolean;
    providerRoutineWrite: boolean;
  };
  source: {
    clientId?: string | null;
    ref?: string | null;
    surface: ProviderRoutineSourceSurface;
  };
}

export type NativeFindProviderRoutines = (
  context: NativeProviderRoutineServiceContext,
  input: ProviderRoutineFindInput
) => Promise<ProviderRoutineFindOutput>;

export type NativeCallProviderRoutine = (
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

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

export function errorResponse(error: unknown) {
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

export async function createNativeProviderRoutineContext(
  req: Request
): Promise<NativeProviderRoutineServiceContext> {
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: req.headers,
  });
  if (auth.access?.kind !== "clerk-oauth" || auth.access.client !== "cli") {
    throw new NativeProxyRouteError(
      "UNAUTHORIZED",
      "Lightfast native CLI OAuth authentication required.",
      401
    );
  }
  if (auth.identity.type !== "active") {
    throw new NativeProxyRouteError(
      "FORBIDDEN",
      "Lightfast native CLI organization binding required.",
      403
    );
  }

  return {
    actor: {
      orgId: auth.identity.orgId,
      userId: auth.identity.userId,
    },
    db,
    log,
    now: () => new Date(),
    scopes: {
      providerRoutineRead: true,
      providerRoutineWrite: true,
    },
    source: {
      clientId: auth.access.clientId,
      ref: auth.identity.orgId,
      surface: "native_cli",
    },
  };
}

export async function loadNativeProviderRoutineServices() {
  return (await import(
    PROVIDER_ROUTINES_PACKAGE
  )) as NativeProviderRoutineServices;
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
