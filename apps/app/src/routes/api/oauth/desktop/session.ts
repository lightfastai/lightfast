import { nativeSessionMetadataSchema } from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  createNativeOAuthFacadeCaller,
  errorResponse,
  jsonResponse,
} from "~/server/oauth/native-auth";

export const Route = createFileRoute("/api/oauth/desktop/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const caller = await createNativeOAuthFacadeCaller({
            headers: request.headers,
            source: "desktop",
          });
          const session = await caller.native.auth.session();
          return jsonResponse(nativeSessionMetadataSchema.parse(session));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
