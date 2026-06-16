import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat/$id/stream")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleWorkspaceAssistantStreamRequest } = await import(
          "~/server/chat/workspace-assistant-stream-route"
        );

        return handleWorkspaceAssistantStreamRequest(request, params.id);
      },
    },
  },
});
