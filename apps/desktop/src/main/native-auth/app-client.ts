import {
  NATIVE_AUTH_HEADERS,
  nativeOAuthConfigSchema,
  nativeRpcAuthSessionSuccessResponseSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import { electronNetFetch } from "@vendor/electron/net";
import { z } from "zod";

import { createAppUrl } from "../app-url";

type FetchLike = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => Promise<Response>;

const appErrorSchema = z
  .object({
    error: z.object({
      code: z.string().min(1),
      message: z.string().min(1).optional(),
    }),
  })
  .passthrough();

async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const parsed = appErrorSchema.safeParse(body);
    const message =
      parsed.success && parsed.data.error.message
        ? parsed.data.error.message
        : `Lightfast app request failed with status ${response.status}`;
    throw new Error(message);
  }
  return schema.parse(body);
}

export function createDesktopNativeAuthClient(
  input: { fetchImpl?: FetchLike } = {}
) {
  const fetchImpl: FetchLike = input.fetchImpl ?? electronNetFetch;
  return {
    async getOAuthConfig() {
      const response = await fetchImpl(
        createAppUrl("/api/oauth/desktop/config").toString(),
        { headers: { accept: "application/json" } }
      );
      return readJson(response, nativeOAuthConfigSchema);
    },
    async finalize(input: {
      accessToken: string;
      attemptId: string;
      state: string;
    }) {
      const response = await fetchImpl(
        createAppUrl("/api/oauth/finalize").toString(),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            attemptId: input.attemptId,
            client: "desktop",
            state: input.state,
          }),
        }
      );
      return readJson(response, nativeSessionMetadataSchema);
    },
    async session(input: { accessToken: string; organizationId: string }) {
      const response = await fetchImpl(
        createAppUrl("/api/desktop/rpc").toString(),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.accessToken}`,
            "content-type": "application/json",
            [NATIVE_AUTH_HEADERS.client]: "desktop",
            [NATIVE_AUTH_HEADERS.organizationId]: input.organizationId,
          },
          body: JSON.stringify({ command: "auth.session" }),
        }
      );
      const envelope = await readJson(
        response,
        nativeRpcAuthSessionSuccessResponseSchema
      );
      return envelope.result;
    },
  };
}
