import {
  nativeFinalizeRequestSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  createNativeOAuthFacadeCaller,
  errorResponse,
  jsonResponse,
} from "~/server/oauth/native-auth";

export const Route = createFileRoute("/api/oauth/finalize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = nativeFinalizeRequestSchema.parse(
            await request.json().catch(() => null)
          );
          const caller = await createNativeOAuthFacadeCaller({
            headers: request.headers,
            source: body.client,
          });
          const session = await caller.native.auth.finalize(body);
          return jsonResponse(nativeSessionMetadataSchema.parse(session));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
