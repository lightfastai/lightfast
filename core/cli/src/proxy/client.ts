import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindOutput,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@lightfast/connector-core/provider-routines";
import type { NativeSession } from "@repo/native-auth-contract";
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
  const url = new URL("/api/native/proxy/routines", input.appUrl);
  if (input.query) {
    url.searchParams.set("query", input.query);
  }
  if (input.provider) {
    url.searchParams.set("provider", input.provider);
  }
  if (input.includeSchema) {
    url.searchParams.set("includeSchema", "true");
  }
  if (input.readOnly) {
    url.searchParams.set("readOnly", "true");
  }
  if (input.routineId) {
    url.searchParams.set("routineId", input.routineId);
  }
  if (input.limit) {
    url.searchParams.set("limit", String(input.limit));
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      ...buildNativeAuthHeaders(input.session),
    },
  });

  return readJson(response, providerRoutineFindOutputSchema);
}

export async function callProxyRoutine(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
  payload: ProviderRoutineCallInput;
  session: NativeSession;
}): Promise<ProviderRoutineCallSuccess> {
  const payload = providerRoutineCallInputSchema.parse(input.payload);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    new URL("/api/native/proxy/call", input.appUrl),
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...buildNativeAuthHeaders(input.session),
      },
      body: JSON.stringify(payload),
    }
  );

  return readJson(response, providerRoutineCallSuccessSchema);
}
