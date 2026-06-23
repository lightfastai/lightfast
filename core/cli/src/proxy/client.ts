import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/api-contract";
import {
  type NativeRpcCommand,
  type NativeSession,
  nativeRpcSuccessResponseSchema,
} from "@repo/native-auth-contract";
import { z } from "zod";

import { buildNativeAuthHeaders } from "../auth/session";

const proxyErrorSchema = z
  .object({
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1).optional(),
    }),
  })
  .passthrough();

export class ProxyClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "ProxyClientError";
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    if (!response.ok) {
      return;
    }
    throw error;
  }
}

async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const body = await readResponseBody(response);
  if (!response.ok) {
    const parsed = proxyErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : "HTTP_ERROR";
    const message =
      parsed.success && parsed.data.error.message
        ? parsed.data.error.message
        : `Lightfast proxy request failed with status ${response.status}`;
    throw new ProxyClientError(message, response.status, code);
  }

  return schema.parse(body);
}

function createCliRpcInput(input: {
  includeSchema?: boolean;
  limit?: number;
  provider?: string;
  query?: string;
  readOnly?: boolean;
  routineId?: string;
}): ProviderRoutineFindInput {
  return providerRoutineFindInputSchema.parse({
    includeSchema: input.includeSchema ? true : undefined,
    limit: input.limit,
    provider: input.provider,
    query: input.query,
    readOnly: input.readOnly ? true : undefined,
    routineId: input.routineId,
  });
}

async function postCliRpc<T>(input: {
  appUrl: string;
  command: NativeRpcCommand;
  commandInput: unknown;
  fetchImpl?: typeof fetch;
  resultSchema: z.ZodType<T>;
  session: NativeSession;
}): Promise<T> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(new URL("/api/cli/rpc", input.appUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...buildNativeAuthHeaders(input.session),
    },
    body: JSON.stringify({
      command: input.command,
      input: input.commandInput,
    }),
  });
  const envelope = await readJson(response, nativeRpcSuccessResponseSchema);
  return input.resultSchema.parse(envelope.result);
}

export async function findProxyRoutines(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
  includeSchema?: boolean;
  limit?: number;
  provider?: string;
  query?: string;
  readOnly?: boolean;
  routineId?: string;
  session: NativeSession;
}): Promise<ProviderRoutineFindOutput> {
  return postCliRpc({
    appUrl: input.appUrl,
    command: "providerRoutines.find",
    commandInput: createCliRpcInput(input),
    fetchImpl: input.fetchImpl,
    resultSchema: providerRoutineFindOutputSchema,
    session: input.session,
  });
}

export async function callProxyRoutine(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
  payload: ProviderRoutineCallInput;
  session: NativeSession;
}): Promise<ProviderRoutineCallSuccess> {
  const payload = providerRoutineCallInputSchema.parse(input.payload);
  return postCliRpc({
    appUrl: input.appUrl,
    command: "providerRoutines.call",
    commandInput: payload,
    fetchImpl: input.fetchImpl,
    resultSchema: providerRoutineCallSuccessSchema,
    session: input.session,
  });
}
