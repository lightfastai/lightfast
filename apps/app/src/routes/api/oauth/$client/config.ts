import { createFileRoute } from "@tanstack/react-router";

async function handleNativeOAuthClientConfigRouteRequest(client: string) {
  const { handleNativeOAuthClientConfigRequest } = await import(
    "@api/app/native-auth/server-routes"
  );

  return handleNativeOAuthClientConfigRequest(client);
}

export const Route = createFileRoute("/api/oauth/$client/config")({
  server: {
    handlers: {
      GET: ({ params }) =>
        handleNativeOAuthClientConfigRouteRequest(params.client),
    },
  },
});
