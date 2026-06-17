import { nativeSessionMetadataSchema } from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  errorResponse,
  getNativeAuthSessionForRequest,
  jsonResponse,
} from "~/server/oauth/native-auth";

export const Route = createFileRoute("/api/oauth/desktop/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getNativeAuthSessionForRequest({
            headers: request.headers,
            source: "desktop",
          });
          return jsonResponse(nativeSessionMetadataSchema.parse(session));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
