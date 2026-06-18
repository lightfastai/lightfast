import { handleSkillIndexEventsRequest } from "@api/app/services/skills/events";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/skills/index/events")({
  server: {
    handlers: {
      GET: ({ request }) => handleSkillIndexEventsRequest(request),
    },
  },
});
