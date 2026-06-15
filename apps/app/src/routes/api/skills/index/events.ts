import { db } from "@db/app/client";
import { createFileRoute } from "@tanstack/react-router";
import { createSkillIndexEventStream } from "~/server/skills/skill-index-event-stream";

export const Route = createFileRoute("/api/skills/index/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveAuthContextFromClerk } = await import(
          "@api/app/auth/identity"
        );
        const authContext = await resolveAuthContextFromClerk({
          db,
          headers: request.headers,
        });
        const identity = authContext.identity;

        if (identity.type === "unauthenticated") {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (identity.type !== "active") {
          return Response.json(
            { error: "Organization required" },
            { status: 403 }
          );
        }
        if (identity.orgGate.bindingStatus !== "bound") {
          return Response.json(
            { error: "Organization setup required" },
            { status: 403 }
          );
        }

        return new Response(
          createSkillIndexEventStream({
            clerkOrgId: identity.orgId,
            signal: request.signal,
          }),
          {
            headers: {
              "cache-control": "no-store, no-cache, no-transform",
              connection: "keep-alive",
              "content-type": "text/event-stream",
              "x-accel-buffering": "no",
            },
          }
        );
      },
    },
  },
});
