import {
  nativeFinalizeRequestSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  errorResponse,
  finalizeNativeAuthAttemptForRequest,
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
          const session = await finalizeNativeAuthAttemptForRequest({
            data: body,
            headers: request.headers,
            source: body.client,
          });
          return jsonResponse(nativeSessionMetadataSchema.parse(session));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
