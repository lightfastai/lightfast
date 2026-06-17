import {
  nativeClientSchema,
  nativeOAuthConfigSchema,
} from "@repo/native-auth-contract";
import { createFileRoute } from "@tanstack/react-router";
import {
  errorResponse,
  getNativeOAuthClientConfig,
  jsonResponse,
} from "~/server/oauth/native-auth";

export const Route = createFileRoute("/api/oauth/$client/config")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const parsedClient = nativeClientSchema.parse(params.client);
          const config = getNativeOAuthClientConfig({
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
