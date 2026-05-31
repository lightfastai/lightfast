import { ORPCError, os } from "@orpc/server";
import { repairIdForSetupRequirement } from "@repo/app-setup-contract";

import type { AuthContext, InitialContext } from "../context";

/**
 * Org setup gate for API-key authenticated oRPC procedures.
 *
 * API-key auth resolves the same active `auth.identity` shape as tRPC. Unkey
 * API keys carry no session claims, so `authMiddleware` attaches the org gate
 * after reading the authoritative DB binding. This middleware only enforces
 * the already-resolved gate.
 *
 * An unbound org is rejected with `FORBIDDEN`: the org must connect a
 * source-control organization (the `bind` task) before its API key can reach
 * product features.
 */
const base = os.$context<InitialContext & AuthContext>();

export const orgGateMiddleware = base.middleware(async ({ context, next }) => {
  if (context.auth.identity.orgGate.bindingStatus !== "bound") {
    const requirement = context.auth.identity.orgGate.nextSetupRequirement;
    const diagnostic = {
      code: "ORG_SETUP_REQUIRED" as const,
      message:
        "This organization has not completed setup. Complete setup before using Lightfast API features.",
      repair: {
        id: repairIdForSetupRequirement(requirement),
      },
    };
    throw new ORPCError("FORBIDDEN", {
      data: { diagnostics: [diagnostic] },
      message: diagnostic.message,
    });
  }
  return next();
});
