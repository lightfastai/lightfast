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

async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const body = (await response.json()) as unknown;

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

export function createLightfastAppClient(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.appUrl.replace(/\/$/, "");
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async getOAuthConfig(): Promise<NativeOAuthConfig> {
      const response = await fetchImpl(
        `${baseUrl}/api/native-auth/cli/oauth-config`,
        { headers: { accept: "application/json" } }
      );
      return readJson(response, nativeOAuthConfigSchema);
    },

    async finalizeNativeAuth(input: {
      accessToken: string;
      attemptId: string;
      state: string;
    }): Promise<NativeSessionMetadata> {
      const response = await fetchImpl(`${baseUrl}/api/native-auth/finalize`, {
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
      });
      return readJson(response, nativeSessionMetadataSchema);
    },
  };
}
