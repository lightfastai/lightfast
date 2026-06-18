import { createFileRoute } from "@tanstack/react-router";

async function handleSkillIndexEventsRouteRequest(request: Request) {
  const { handleSkillIndexEventsRequest } = await import(
    "@api/app/internal-api/skills-events"
  );

  return handleSkillIndexEventsRequest(request);
}

export const Route = createFileRoute("/api/skills/index/events")({
  server: {
    handlers: {
      GET: ({ request }) => handleSkillIndexEventsRouteRequest(request),
    },
  },
});
