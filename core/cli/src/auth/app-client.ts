import {
  type NativeOAuthConfig,
  type NativeSessionMetadata,
  nativeOAuthConfigSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import { z } from "zod";

const appErrorSchema = z
  .object({
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1).optional(),
    }),
  })
  .passthrough();

export class LightfastAppClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = "LightfastAppClientError";
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

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
    const parsed = appErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : "HTTP_ERROR";
    const message =
      parsed.success && parsed.data.error.message
        ? parsed.data.error.message
        : `Lightfast app request failed with status ${response.status}`;
    throw new LightfastAppClientError(message, response.status, code);
  }

  return schema.parse(body);
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createLightfastAppClient(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}) {
  const baseUrl = input.appUrl.replace(/\/$/, "");
  const fetchImpl = input.fetchImpl ?? fetch;
  const requestTimeoutMs = input.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  return {
    async getOAuthConfig(): Promise<NativeOAuthConfig> {
      const response = await fetchWithTimeout(
        fetchImpl,
        `${baseUrl}/api/native-auth/cli/oauth-config`,
        { headers: { accept: "application/json" } },
        requestTimeoutMs
      );
      return readJson(response, nativeOAuthConfigSchema);
    },

    async finalizeNativeAuth(input: {
      accessToken: string;
      attemptId: string;
      state: string;
    }): Promise<NativeSessionMetadata> {
      const response = await fetchWithTimeout(
        fetchImpl,
        `${baseUrl}/api/native-auth/finalize`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            attemptId: input.attemptId,
            client: "cli",
            state: input.state,
          }),
        },
        requestTimeoutMs
      );
      return readJson(response, nativeSessionMetadataSchema);
    },
  };
}
