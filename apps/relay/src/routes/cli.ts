import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { redis } from "@vendor/upstash";
import { cliApiKeyAuth } from "../middleware/cli-auth.js";

export const cliRouter = new Hono<{
  Variables: { cliOrgId: string };
}>();

const POLL_INTERVAL_MS = 200;
const HEARTBEAT_INTERVAL_MS = 20_000;

cliRouter.get("/stream", cliApiKeyAuth, (c) => {
  const orgId = c.get("cliOrgId");
  const lastEventId = c.req.header("Last-Event-ID") ?? "0-0";
  const streamKey = `cli:events:${orgId}`;

  return streamSSE(c, async (stream) => {
    let cursor = lastEventId;
    let heartbeatCounter = 0;
    const heartbeatEvery = Math.floor(HEARTBEAT_INTERVAL_MS / POLL_INTERVAL_MS);

    await redis.expire(streamKey, 3600);

    while (true) {
      // Poll Redis stream for new events since cursor
      const entries = await redis.xrange(streamKey, `(${cursor}`, "+", 50);

      if (Object.keys(entries).length > 0) {
        for (const [id, fields] of Object.entries(entries)) {
          const data = (fields as Record<string, string>).data;
          if (data) {
            await stream.writeSSE({ data, event: "webhook", id });
            cursor = id;
          }
        }
      }

      heartbeatCounter++;
      if (heartbeatCounter >= heartbeatEvery) {
        await stream.writeSSE({
          data: JSON.stringify({ type: "ping" }),
          event: "heartbeat",
          id: `hb-${Date.now()}`,
        });
        heartbeatCounter = 0;
      }

      await stream.sleep(POLL_INTERVAL_MS);
    }
  });
});
