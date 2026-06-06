import { resolveAuthContextFromClerk } from "@api/app/auth/identity";
import { db } from "@db/app/client";

import { createSkillIndexEventStream } from "./skill-index-event-stream";

export const maxDuration = 30;

export async function GET(req: Request) {
  const authContext = await resolveAuthContextFromClerk({
    db,
    headers: req.headers,
  });
  const identity = authContext.identity;

  if (identity.type === "unauthenticated") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.type !== "active") {
    return Response.json({ error: "Organization required" }, { status: 403 });
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
      signal: req.signal,
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
}
