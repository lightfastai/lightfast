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
import {
  type ProviderRoutineCommandDeps,
  providerRoutineCallCommand,
  providerRoutineFindCommand,
} from "../domain/provider-routines";
import { createProviderRoutineCommandDeps } from "../services/provider-routines/command-deps";
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

async function createCliProviderRoutineContext(req: Request) {
  const { db } = await import("@db/app/client");
  const { resolveAuthContextFromClerk } = await import("../auth/identity");
  const { loadAgentConnectorRuntimeTools } = await import(
    "../services/connectors/runtime"
  );
  const adapters: Pick<
    ProviderRoutineCommandDeps,
    "loadConnectorRuntimeTools"
  > = {
    loadConnectorRuntimeTools: async (input) =>
      await loadAgentConnectorRuntimeTools({
        ...input,
        sourceSurface: "native_cli",
      }),
  };
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
    ctx: {
      actor: {
        client: "cli" as const,
        clientId: access.clientId,
        kind: "nativeClient" as const,
        orgId: identity.orgId,
        source: "cli" as const,
        userId: identity.userId,
      },
      caller: { client: "cli" as const, kind: "firstPartyClient" as const },
      request: { id: crypto.randomUUID(), source: "cli-rpc" as const },
    },
    deps: createProviderRoutineCommandDeps({
      db,
      ...adapters,
      log,
      now: () => new Date(),
    }),
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
    const input = parseProviderRoutineCallInput(commandInput);
    const commandContext = await createCliProviderRoutineContext(request);
    const result = await providerRoutineCallCommand.run({
      ...commandContext,
      input: { input },
    });
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
    const input = parseProviderRoutineFindInput(commandInput);
    const commandContext = await createCliProviderRoutineContext(request);
    const result = await providerRoutineFindCommand.run({
      ...commandContext,
      input: { input },
    });
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
