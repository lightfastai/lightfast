import "@tanstack/react-start/server-only";

import { db } from "@db/app/client";

export async function createTanStackTRPCContext(opts: { headers: Headers }) {
  return {
    auth: {
      identity: { type: "unauthenticated" as const },
    },
    db,
    headers: opts.headers,
  };
}
