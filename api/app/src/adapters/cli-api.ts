import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/api-contract";
import {
  NATIVE_AUTH_HEADERS,
  type NativeRpcProviderRoutineErrorCode,
  nativeRpcProviderRoutineErrorCodeSchema,
} from "@repo/native-auth-contract";
import type { ProviderRoutineServiceContext } from "../services/provider-routines/context";
import { handleNativeRpcRequest, NativeRpcRouteError } from "./native-rpc";

const cliNativeRpcCommands = [
  "auth.session",
  "providerRoutines.find",
  "providerRoutines.call",
] as const;

const log = {
  error: (message: string, metadata?: Record<string, unknown>) =>
    console.error(message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) =>
    console.info(message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    console.warn(message, metadata),
};

type CliProviderRoutineServiceContext = ProviderRoutineServiceContext;

export function handleCliNativeRpcRequest(request: Request) {
  return handleNativeRpcRequest(request, {
    allowedCommands: cliNativeRpcCommands,
    handlers: {
      providerRoutineCall: handleCliProviderRoutineCallCommand,
      providerRoutineFind: handleCliProviderRoutineFindCommand,
    },
    source: "cli",
  });
}

async function createCliProviderRoutineContext(
  req: Request
): Promise<CliProviderRoutineServiceContext> {
  const { db } = await import("@db/app/client");
  const { resolveAuthContextFromClerk } = await import("../auth/identity");
  const { loadAgentConnectorRuntimeTools } = await import(
    "../services/connectors/runtime"
  );
  const headers = new Headers(req.headers);
  headers.set(NATIVE_AUTH_HEADERS.client, "cli");
  const auth = await resolveAuthContextFromClerk({
    db,
    headers,
  });
  const access = auth.access;
  const identity = auth.identity;
  if (access?.kind !== "clerk-oauth" || access.client !== "cli") {
    throw new NativeRpcRouteError(
      "UNAUTHORIZED",
      "Lightfast native CLI OAuth authentication required.",
      401
    );
  }
  if (identity.type !== "active") {
    throw new NativeRpcRouteError(
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

async function handleCliProviderRoutineCallCommand({
  commandInput,
  request,
}: {
  commandInput: unknown;
  request: Request;
}) {
  try {
    const { callProviderRoutine } = await import(
      "../services/provider-routines/call"
    );
    const input = parseProviderRoutineCallInput(commandInput);
    const context = await createCliProviderRoutineContext(request);
    const result = await callProviderRoutine(context, input);
    return providerRoutineCallSuccessSchema.parse(result);
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

async function handleCliProviderRoutineFindCommand({
  commandInput,
  request,
}: {
  commandInput: unknown;
  request: Request;
}) {
  try {
    const { findProviderRoutines } = await import(
      "../services/provider-routines/find"
    );
    const input = parseProviderRoutineFindInput(commandInput);
    const context = await createCliProviderRoutineContext(request);
    const result = await findProviderRoutines(context, input);
    return providerRoutineFindOutputSchema.parse(result);
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

function parseProviderRoutineCallInput(input: unknown) {
  const parsed = providerRoutineCallInputSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidCommandInput();
  }
  return parsed.data;
}

function parseProviderRoutineFindInput(input: unknown) {
  const parsed = providerRoutineFindInputSchema.safeParse(
    input === undefined ? {} : input
  );
  if (!parsed.success) {
    throw invalidCommandInput();
  }
  return parsed.data;
}

function invalidCommandInput() {
  return new NativeRpcRouteError(
    "BAD_REQUEST",
    "Native RPC request is invalid.",
    400
  );
}

function normalizeCommandError(error: unknown) {
  if (error instanceof NativeRpcRouteError) {
    return error;
  }

  if (isProviderRoutineError(error)) {
    return new NativeRpcRouteError(
      error.code,
      error.publicMessage,
      statusFromProviderRoutineError(error.code)
    );
  }

  console.error("[cli-provider-routines] Unexpected route error", error);
  return new NativeRpcRouteError(
    "INTERNAL_SERVER_ERROR",
    "Unexpected CLI provider routine error",
    500
  );
}

function isProviderRoutineError(error: unknown): error is Error & {
  code: NativeRpcProviderRoutineErrorCode;
  publicMessage: string;
} {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    nativeRpcProviderRoutineErrorCodeSchema.safeParse(error.code).success &&
    "publicMessage" in error &&
    typeof error.publicMessage === "string"
  );
}

function statusFromProviderRoutineError(code: string): 400 | 403 | 404 | 502 {
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
