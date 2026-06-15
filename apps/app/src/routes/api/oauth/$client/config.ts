import {
  nativeClientSchema,
  nativeOAuthConfigSchema,
} from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  createNativeOAuthFacadeCaller,
  errorResponse,
  jsonResponse,
} from "~/server/oauth/native-auth";

export const Route = createFileRoute("/api/oauth/$client/config")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const parsedClient = nativeClientSchema.parse(params.client);
          const caller = await createNativeOAuthFacadeCaller({
            headers: request.headers,
            source: parsedClient,
          });
          const config = await caller.native.auth.oauthConfig({
            client: parsedClient,
          });
          return jsonResponse(nativeOAuthConfigSchema.parse(config));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
