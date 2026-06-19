import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultGitHubSetupCommandDeps,
  startGitHubOrgSetupCommand,
  syncGitHubBindingClaimCommand,
  verifyGitHubLightfastRepoCommand,
} from "../../domain/github-setup";

export type StartGitHubOrgSetupInput = z.input<
  typeof startGitHubOrgSetupCommand.input
>;
export type StartGitHubOrgSetupResult = z.output<
  typeof startGitHubOrgSetupCommand.output
>;
export type SyncGitHubBindingClaimResult = z.output<
  typeof syncGitHubBindingClaimCommand.output
>;
export type VerifyGitHubLightfastRepoResult = z.output<
  typeof verifyGitHubLightfastRepoCommand.output
>;

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

async function createTanStackGitHubSetupContext() {
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

export const startGitHubOrgSetup = createServerFn({ method: "POST" })
  .inputValidator(startGitHubOrgSetupCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await startGitHubOrgSetupCommand.run({
        ctx: await createTanStackGitHubSetupContext(),
        deps: createDefaultGitHubSetupCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const syncGitHubBindingClaim = createServerFn({
  method: "POST",
})
  .inputValidator(syncGitHubBindingClaimCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await syncGitHubBindingClaimCommand.run({
        ctx: await createTanStackGitHubSetupContext(),
        deps: createDefaultGitHubSetupCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const verifyGitHubLightfastRepo = createServerFn({
  method: "POST",
})
  .inputValidator(verifyGitHubLightfastRepoCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await verifyGitHubLightfastRepoCommand.run({
        ctx: await createTanStackGitHubSetupContext(),
        deps: createDefaultGitHubSetupCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });
