import "@tanstack/react-start/server-only";

import { createTRPCContext } from "@api/app";

export async function createTanStackTRPCContext(opts: { headers: Headers }) {
  return createTRPCContext({ headers: opts.headers });
}
