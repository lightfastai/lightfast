// GET /api/cron/platform-heartbeat
// Auth: Authorization: Bearer ${CRON_SECRET} (Vercel cron contract)
// Smoke probe for the `cron` ServiceCaller — calls platform.system.health.

import { env } from "~/env";
import { platformAs } from "~/lib/platform";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (req.headers.get("authorization") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await platformAs("cron").system.health.query();
  return Response.json({ caller: "cron", platform: result });
}
