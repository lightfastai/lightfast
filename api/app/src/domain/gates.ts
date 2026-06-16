import type { Actor, ExecutionContext } from "./actor";
import { AuthzError } from "./errors";

export type BoundClerkOrgActor = Extract<Actor, { kind: "clerkUser" }> & {
  orgGate: NonNullable<Extract<Actor, { kind: "clerkUser" }>["orgGate"]>;
  orgId: string;
};

export type ActiveClerkOrgActor = Extract<Actor, { kind: "clerkUser" }> & {
  orgGate: NonNullable<Extract<Actor, { kind: "clerkUser" }>["orgGate"]>;
  orgId: string;
};

export type ClerkOrgAdminActor = ActiveClerkOrgActor & {
  orgRole: "admin";
};

export function requireActiveClerkOrgActor(
  ctx: ExecutionContext
): ActiveClerkOrgActor {
  if (ctx.actor.kind !== "clerkUser") {
    throw new AuthzError(
      "CLERK_USER_REQUIRED",
      "A signed-in Lightfast user is required."
    );
  }

  if (!(ctx.actor.orgId && ctx.actor.orgGate)) {
    throw new AuthzError(
      "ORG_REQUIRED",
      "Organization required. Please create or join an organization first."
    );
  }

  return ctx.actor as ActiveClerkOrgActor;
}

export function requireClerkUserActor(ctx: ExecutionContext) {
  if (ctx.actor.kind !== "clerkUser") {
    throw new AuthzError(
      "CLERK_USER_REQUIRED",
      "A signed-in Lightfast user is required."
    );
  }

  return ctx.actor;
}

export function requireBoundClerkOrgActor(
  ctx: ExecutionContext
): BoundClerkOrgActor {
  const actor = requireActiveClerkOrgActor(ctx);

  if (actor.orgGate.bindingStatus !== "bound") {
    throw new AuthzError(
      "ORG_SETUP_REQUIRED",
      "Organization setup required. Complete setup before using Lightfast features.",
      {
        nextSetupRequirement: actor.orgGate.nextSetupRequirement,
      }
    );
  }

  return actor;
}

export function requireClerkOrgAdminActor(
  ctx: ExecutionContext
): ClerkOrgAdminActor {
  const actor = requireActiveClerkOrgActor(ctx);

  if (actor.orgRole !== "admin") {
    throw new AuthzError(
      "PERMISSION_REQUIRED",
      "Only organization administrators can perform this action."
    );
  }

  return actor as ClerkOrgAdminActor;
}
