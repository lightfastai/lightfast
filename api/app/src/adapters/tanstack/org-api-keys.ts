import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { log } from "@vendor/observability/log/next";
import { getUnkeyClient, unkeyEnv } from "@vendor/unkey/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createOrgApiKeyCommand,
  deleteOrgApiKeyCommand,
  listOrgApiKeysCommand,
  type OrgApiKeyCommandDeps,
  revokeOrgApiKeyCommand,
  rotateOrgApiKeyCommand,
} from "../../domain/org-api-keys";

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

async function createTanStackOrgApiKeyContext() {
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
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

function isUnkeyStatus(error: unknown, statusCode: number) {
  return (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode
  );
}

function commandDeps(): OrgApiKeyCommandDeps {
  return {
    apiId: unkeyEnv.UNKEY_API_ID,
    isProviderConflictError: (error) => isUnkeyStatus(error, 409),
    isProviderNotFoundError: (error) => isUnkeyStatus(error, 404),
    log,
    now: Date.now,
    provider: getUnkeyClient(),
  };
}

export const listOrgApiKeys = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await listOrgApiKeysCommand.run({
        ctx: await createTanStackOrgApiKeyContext(),
        deps: commandDeps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const createOrgApiKey = createServerFn({ method: "POST" })
  .inputValidator(createOrgApiKeyCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createOrgApiKeyCommand.run({
        ctx: await createTanStackOrgApiKeyContext(),
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const revokeOrgApiKey = createServerFn({ method: "POST" })
  .inputValidator(revokeOrgApiKeyCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await revokeOrgApiKeyCommand.run({
        ctx: await createTanStackOrgApiKeyContext(),
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const deleteOrgApiKey = createServerFn({ method: "POST" })
  .inputValidator(deleteOrgApiKeyCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await deleteOrgApiKeyCommand.run({
        ctx: await createTanStackOrgApiKeyContext(),
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const rotateOrgApiKey = createServerFn({ method: "POST" })
  .inputValidator(rotateOrgApiKeyCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await rotateOrgApiKeyCommand.run({
        ctx: await createTanStackOrgApiKeyContext(),
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListOrgApiKeysResult = Awaited<ReturnType<typeof listOrgApiKeys>>;
