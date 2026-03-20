import { handle, realtime } from "@repo/console-upstash-realtime";
import { auth } from "@vendor/clerk/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handle({
  realtime,
  middleware: async ({ channels }) => {
    const { userId, orgId } = await auth();

    if (!(userId && orgId)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Validate requested channels belong to this org
    const allowedChannel = `org-${orgId}`;
    const unauthorized = channels.some((c) => c !== allowedChannel);
    if (unauthorized) {
      return new Response("Forbidden", { status: 403 });
    }

    // Return undefined to allow the connection
    return undefined;
  },
});
