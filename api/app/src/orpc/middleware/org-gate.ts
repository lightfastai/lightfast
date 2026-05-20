import { isOrgBound } from "@db/app";
import { db } from "@db/app/client";
import { ORPCError, os } from "@orpc/server";

import type { AuthContext, InitialContext } from "../context";

/**
 * Org setup gate for API-key authenticated oRPC procedures.
 *
 * Clerk API keys carry an org subject but no session claims, so the
 * `lf_binding_status` token claim that gates the tRPC `boundOrgProcedure` is
 * unavailable here. This middleware re-derives the gate from the authoritative
 * DB binding instead — it must run *after* `authMiddleware`, which resolves the
 * verified `clerkOrgId` into context.
 *
 * An unbound org is rejected with `FORBIDDEN`: the org must connect a
 * source-control organization (the `bind` task) before its API key can reach
 * product features.
 */
const base = os.$context<InitialContext & AuthContext>();

export const orgGateMiddleware = base.middleware(async ({ context, next }) => {
  const bound = await isOrgBound(db, context.clerkOrgId);
  if (!bound) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "This organization has not completed setup. Connect a source-control organization before using Lightfast API features.",
    });
  }
  return next();
});
