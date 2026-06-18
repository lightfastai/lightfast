import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleWorkspaceAssistantChatRequest } = await import(
          "@api/app/internal-api/workspace-assistant"
        );

        return handleWorkspaceAssistantChatRequest(request);
      },
    },
  },
});
