import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
  rotateOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import { log } from "@vendor/observability/log/next";
import type { KeyResponseData, UnkeyClient } from "@vendor/unkey";
import { getUnkeyClient, unkeyEnv } from "@vendor/unkey/server";
import { z } from "zod";

import { UNKEY_API_KEY_PREFIX } from "../../auth/api-key-prefix";
import { defineCommand } from "../command";
import { NotFoundError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type UnkeyListKeysResult = Awaited<ReturnType<UnkeyClient["apis"]["listKeys"]>>;
type UnkeyCreateKeyResult = Awaited<
  ReturnType<UnkeyClient["keys"]["createKey"]>
>["data"];
type UnkeyRerollKeyResult = Awaited<
  ReturnType<UnkeyClient["keys"]["rerollKey"]>
>["data"];

type ListOrgApiKeysResult = KeyResponseData[];
type CreateOrgApiKeyResult = UnkeyCreateKeyResult;
type RotateOrgApiKeyResult = UnkeyRerollKeyResult;

interface OrgApiKeyCommandDeps {
  apiId: string;
  log: Pick<typeof log, "info">;
  now: () => number;
  unkey: UnkeyClient;
}

export function createDefaultOrgApiKeyCommandDeps(
  input: Partial<Omit<OrgApiKeyCommandDeps, "log">> & {
    log?: Pick<typeof log, "info">;
  } = {}
): OrgApiKeyCommandDeps {
  return {
    apiId: input.apiId ?? unkeyEnv.UNKEY_API_ID,
    log: input.log ?? log,
    now: input.now ?? Date.now,
    unkey: input.unkey ?? getUnkeyClient(),
  };
}

const listOrgApiKeysInput = z.object({}).strict();
const listOrgApiKeysOutput = z.custom<ListOrgApiKeysResult>(Array.isArray);
const createOrgApiKeyOutput = z.custom<CreateOrgApiKeyResult>(
  (value) => typeof value === "object" && value !== null
);
const rotateOrgApiKeyOutput = z.custom<RotateOrgApiKeyResult>(
  (value) => typeof value === "object" && value !== null
);
const successOutput = z.object({ success: z.literal(true) });

function isUnkeyStatus(error: unknown, statusCode: number) {
  return (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode
  );
}

async function ensureUnkeyOrgIdentity(input: {
  deps: OrgApiKeyCommandDeps;
  orgId: string;
}) {
  try {
    await input.deps.unkey.identities.createIdentity({
      externalId: input.orgId,
      meta: { clerkOrgId: input.orgId },
    });
  } catch (error) {
    if (isUnkeyStatus(error, 409)) {
      return;
    }
    throw error;
  }
}

async function getOrgApiKeyForOrg(input: {
  deps: OrgApiKeyCommandDeps;
  keyId: string;
  orgId: string;
}) {
  let response: Awaited<ReturnType<UnkeyClient["keys"]["getKey"]>>;
  try {
    response = await input.deps.unkey.keys.getKey({
      decrypt: false,
      keyId: input.keyId,
    });
  } catch (error) {
    if (isUnkeyStatus(error, 404)) {
      throw new NotFoundError("ORG_API_KEY_NOT_FOUND", "API key not found.");
    }
    throw error;
  }

  if (response.data.identity?.externalId !== input.orgId) {
    throw new NotFoundError("ORG_API_KEY_NOT_FOUND", "API key not found.");
  }

  return response.data;
}

export const listOrgApiKeysCommand = defineCommand<
  "orgApiKeys.list",
  typeof listOrgApiKeysInput,
  typeof listOrgApiKeysOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.list",
  input: listOrgApiKeysInput,
  output: listOrgApiKeysOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const keys: KeyResponseData[] = [];
    let cursor: string | undefined;

    do {
      const response: UnkeyListKeysResult = await deps.unkey.apis.listKeys({
        apiId: deps.apiId,
        cursor,
        decrypt: false,
        externalId: actor.orgId,
        limit: 100,
      });

      keys.push(...response.data);
      cursor = response.pagination?.hasMore
        ? response.pagination.cursor
        : undefined;
    } while (cursor);

    return keys;
  },
});

export const createOrgApiKeyCommand = defineCommand<
  "orgApiKeys.create",
  typeof createOrgApiKeySchema,
  typeof createOrgApiKeyOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.create",
  input: createOrgApiKeySchema,
  output: createOrgApiKeyOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await ensureUnkeyOrgIdentity({ deps, orgId: actor.orgId });

    const expires = input.secondsUntilExpiration
      ? deps.now() + input.secondsUntilExpiration * 1000
      : undefined;
    const response = await deps.unkey.keys.createKey({
      apiId: deps.apiId,
      externalId: actor.orgId,
      ...(expires ? { expires } : {}),
      meta: {
        createdByUserId: actor.userId,
        source: "dashboard",
      },
      name: input.name,
      prefix: UNKEY_API_KEY_PREFIX,
      recoverable: false,
    });

    deps.log.info("[org-api-keys] created", {
      clerkOrgId: actor.orgId,
      keyId: response.data.keyId,
      name: input.name,
    });

    return response.data;
  },
});

export const revokeOrgApiKeyCommand = defineCommand<
  "orgApiKeys.revoke",
  typeof revokeOrgApiKeySchema,
  typeof successOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.revoke",
  input: revokeOrgApiKeySchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    await deps.unkey.keys.updateKey({
      enabled: false,
      keyId: input.keyId,
    });

    deps.log.info("[org-api-keys] revoked", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return { success: true as const };
  },
});

export const deleteOrgApiKeyCommand = defineCommand<
  "orgApiKeys.delete",
  typeof deleteOrgApiKeySchema,
  typeof successOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.delete",
  input: deleteOrgApiKeySchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    await deps.unkey.keys.deleteKey({
      keyId: input.keyId,
      permanent: false,
    });

    deps.log.info("[org-api-keys] deleted", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return { success: true as const };
  },
});

export const rotateOrgApiKeyCommand = defineCommand<
  "orgApiKeys.rotate",
  typeof rotateOrgApiKeySchema,
  typeof rotateOrgApiKeyOutput,
  OrgApiKeyCommandDeps
>({
  name: "orgApiKeys.rotate",
  input: rotateOrgApiKeySchema,
  output: rotateOrgApiKeyOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);

    await getOrgApiKeyForOrg({
      deps,
      keyId: input.keyId,
      orgId: actor.orgId,
    });
    const response = await deps.unkey.keys.rerollKey({
      expiration: input.revokeOldAfterMs ?? 0,
      keyId: input.keyId,
    });

    deps.log.info("[org-api-keys] rotated", {
      clerkOrgId: actor.orgId,
      keyId: input.keyId,
    });

    return response.data;
  },
});
