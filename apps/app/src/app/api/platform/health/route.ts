// GET /api/platform/health
// Auth: x-internal-probe header == env.INTERNAL_PROBE_TOKEN
// Smoke probe for the `app` ServiceCaller — calls platform.system.health.

import { env } from "~/env";
import { platformAs } from "~/lib/platform";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (req.headers.get("x-internal-probe") !== env.INTERNAL_PROBE_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await platformAs("app").system.health.query();
  return Response.json({ caller: "app", platform: result });
}
