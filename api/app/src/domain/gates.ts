import type { Actor, ExecutionContext } from "./actor";
import { AuthzError } from "./errors";

export type BoundClerkOrgActor = Extract<Actor, { kind: "clerkUser" }> & {
  orgId: string;
};

export function requireBoundClerkOrgActor(
  ctx: ExecutionContext
): BoundClerkOrgActor {
  if (ctx.actor.kind !== "clerkUser") {
    throw new AuthzError(
      "CLERK_USER_REQUIRED",
      "A signed-in Lightfast user is required."
    );
  }

  if (ctx.actor.orgGate.bindingStatus !== "bound") {
    throw new AuthzError(
      "ORG_SETUP_REQUIRED",
      "Organization setup required. Complete setup before using Lightfast features.",
      {
        nextSetupRequirement: ctx.actor.orgGate.nextSetupRequirement,
      }
    );
  }

  return ctx.actor;
}
