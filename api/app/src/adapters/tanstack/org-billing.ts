import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clerkClient, toPlainClerkResource } from "@vendor/clerk/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  cancelOrgBillingSubscriptionItemCommand,
  getOrgBillingOverviewCommand,
  type OrgBillingCommandDeps,
} from "../../domain/org-billing";

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

async function createTanStackOrgBillingContext() {
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

async function commandDeps(): Promise<OrgBillingCommandDeps> {
  const clerk = await clerkClient();

  return {
    billing: {
      cancelSubscriptionItem: (subscriptionItemId, input) =>
        clerk.billing.cancelSubscriptionItem(subscriptionItemId, input),
      getOrganizationBillingSubscription: (orgId) =>
        clerk.billing.getOrganizationBillingSubscription(orgId),
      getPlanList: (input) => clerk.billing.getPlanList(input),
    },
    toPlainClerkResource,
  };
}

export const getOrgBillingOverview = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await getOrgBillingOverviewCommand.run({
      ctx: await createTanStackOrgBillingContext(),
      deps: await commandDeps(),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const cancelOrgBillingSubscriptionItem = createServerFn({
  method: "POST",
})
  .inputValidator(cancelOrgBillingSubscriptionItemCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await cancelOrgBillingSubscriptionItemCommand.run({
        ctx: await createTanStackOrgBillingContext(),
        deps: await commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type OrgBillingOverviewResult = Awaited<
  ReturnType<typeof getOrgBillingOverview>
>;
export type CancelOrgBillingSubscriptionItemResult = Awaited<
  ReturnType<typeof cancelOrgBillingSubscriptionItem>
>;
