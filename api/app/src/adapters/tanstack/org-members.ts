import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clerkClient } from "@vendor/clerk/server";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  inviteOrgMemberCommand,
  listOrgMembersCommand,
  type OrgMembersCommandDeps,
  removeOrgMemberCommand,
  revokeOrgInvitationCommand,
  updateOrgMemberRoleCommand,
} from "../../domain/org-members";

function requestId() {
  return crypto.randomUUID();
}

function maybeMarkOrgAdmin(input: {
  actor: Actor;
  auth: Awaited<ReturnType<typeof resolveAuthContextFromClerk>>;
}): Actor {
  if (
    input.actor.kind === "clerkUser" &&
    input.auth.identity.type === "active" &&
    input.auth.access?.kind === "clerk-session" &&
    input.auth.access.userId === input.auth.identity.userId &&
    input.auth.access.orgId === input.auth.identity.orgId &&
    input.auth.access.has({ role: "org:admin" })
  ) {
    return { ...input.actor, orgRole: "admin" };
  }

  return input.actor;
}

async function createTanStackOrgMembersContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  const actor = actorFromAuthIdentity(auth.identity, "web");

  return {
    actor: maybeMarkOrgAdmin({ actor, auth }),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    const mappedError = new Error(error.message, { cause: error });
    mappedError.name = "DomainError";
    throw mappedError;
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

async function commandDeps(): Promise<OrgMembersCommandDeps> {
  const clerk = await clerkClient();

  return {
    isClerkConflictError,
    organizations: {
      createOrganizationInvitation: (input) =>
        clerk.organizations.createOrganizationInvitation(input),
      deleteOrganizationMembership: (input) =>
        clerk.organizations.deleteOrganizationMembership(input),
      getOrganizationInvitationList: (input) =>
        clerk.organizations.getOrganizationInvitationList(input),
      getOrganizationMembershipList: (input) =>
        clerk.organizations.getOrganizationMembershipList(input),
      revokeOrganizationInvitation: (input) =>
        clerk.organizations.revokeOrganizationInvitation(input),
      updateOrganizationMembership: (input) =>
        clerk.organizations.updateOrganizationMembership(input),
    },
  };
}

export const listOrgMembers = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await listOrgMembersCommand.run({
        ctx: await createTanStackOrgMembersContext(),
        deps: await commandDeps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const inviteOrgMember = createServerFn({ method: "POST" })
  .inputValidator(inviteOrgMemberCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await inviteOrgMemberCommand.run({
        ctx: await createTanStackOrgMembersContext(),
        deps: await commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const updateOrgMemberRole = createServerFn({ method: "POST" })
  .inputValidator(updateOrgMemberRoleCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await updateOrgMemberRoleCommand.run({
        ctx: await createTanStackOrgMembersContext(),
        deps: await commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .inputValidator(removeOrgMemberCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await removeOrgMemberCommand.run({
        ctx: await createTanStackOrgMembersContext(),
        deps: await commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const revokeOrgInvitation = createServerFn({ method: "POST" })
  .inputValidator(revokeOrgInvitationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await revokeOrgInvitationCommand.run({
        ctx: await createTanStackOrgMembersContext(),
        deps: await commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListOrgMembersResult = Awaited<ReturnType<typeof listOrgMembers>>;
