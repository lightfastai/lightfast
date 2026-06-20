import {
  getIdentityIndexStateBySourceControlRepositoryId,
  listIdentityIndexFiles,
  listIdentityIndexRefreshCandidates,
} from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { log } from "@vendor/observability/log/next";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  getOrgIdentityCommand,
  type OrgIdentityCommandDeps,
} from "../../domain/org-identity";
import { inngest } from "../../inngest/client";
import { createIdentityRefreshDedupeKey } from "../../inngest/workflow/identity-refresh-event";
import { isVerifiedLightfastIdentityRepository } from "../../services/identity/eligibility";
import { readIdentityRepositoryMainRef } from "../../services/identity/github";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackOrgIdentityContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });

  return {
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

async function requestIdentityRefresh(sourceControlRepositoryId: number) {
  try {
    await inngest.send({
      data: {
        dedupeKey: createIdentityRefreshDedupeKey({
          reason: "read",
          sourceControlRepositoryId,
        }),
        reason: "read",
        sourceControlRepositoryId,
      },
      name: "app/identity.index.refresh.requested",
    });
  } catch (error) {
    log.error("[org-identity] refresh enqueue failed", {
      error,
      sourceControlRepositoryId,
    });
    return;
  }
}

function deps(): OrgIdentityCommandDeps {
  return {
    db,
    getIdentityIndexStateBySourceControlRepositoryId,
    isVerifiedLightfastIdentityRepository,
    listIdentityIndexFiles,
    listIdentityIndexRefreshCandidates,
    readIdentityRepositoryMainRef,
    requestIdentityRefresh,
  };
}

export const getOrgIdentity = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await getOrgIdentityCommand.run({
        ctx: await createTanStackOrgIdentityContext(),
        deps: deps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export type OrgIdentityResult = Awaited<ReturnType<typeof getOrgIdentity>>;
