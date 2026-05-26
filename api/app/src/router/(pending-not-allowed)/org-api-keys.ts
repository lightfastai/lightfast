import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import type { KeyResponseData, UnkeyClient } from "@vendor/unkey";
import { getUnkeyClient, unkeyEnv } from "@vendor/unkey/server";

import { orgAdminProcedure, orgProcedure } from "../../trpc";

/**
 * Organization API Keys Router (Unkey-backed)
 *
 * Keys are minted, listed, revoked, and deleted via Unkey. The full key is only
 * present on `create`; surface it once and never read it again.
 */
function isUnkeyStatus(error: unknown, statusCode: number) {
  return (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === statusCode
  );
}

async function ensureUnkeyOrgIdentity(input: {
  orgId: string;
  unkey: UnkeyClient;
}) {
  try {
    await input.unkey.identities.createIdentity({
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

async function getOrgApiKeyForOrg(input: { keyId: string; orgId: string }) {
  const unkey = getUnkeyClient();
  let response: Awaited<ReturnType<typeof unkey.keys.getKey>>;
  try {
    response = await unkey.keys.getKey({
      decrypt: false,
      keyId: input.keyId,
    });
  } catch (error) {
    if (isUnkeyStatus(error, 404)) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "API key not found",
      });
    }
    throw error;
  }

  if (response.data.identity?.externalId !== input.orgId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "API key not found",
    });
  }

  return response.data;
}

export const orgApiKeysRouter = {
  list: orgProcedure.query(async ({ ctx }) => {
    const unkey = getUnkeyClient();
    const keys: KeyResponseData[] = [];
    let cursor: string | undefined;

    do {
      const response = await unkey.apis.listKeys({
        apiId: unkeyEnv.UNKEY_API_ID,
        cursor,
        decrypt: false,
        externalId: ctx.auth.identity.orgId,
        limit: 100,
      });

      keys.push(...response.data);
      cursor = response.pagination?.hasMore
        ? response.pagination.cursor
        : undefined;
    } while (cursor);

    return keys;
  }),

  create: orgAdminProcedure
    .input(createOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const unkey = getUnkeyClient();
      await ensureUnkeyOrgIdentity({
        orgId: ctx.auth.identity.orgId,
        unkey,
      });
      const expires = input.secondsUntilExpiration
        ? Date.now() + input.secondsUntilExpiration * 1000
        : undefined;
      const response = await unkey.keys.createKey({
        apiId: unkeyEnv.UNKEY_API_ID,
        externalId: ctx.auth.identity.orgId,
        ...(expires ? { expires } : {}),
        meta: {
          createdByUserId: ctx.auth.identity.userId,
          source: "dashboard",
        },
        name: input.name,
        prefix: "ak",
        recoverable: false,
      });
      const key = response.data;
      log.info("[org-api-keys] created", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: key.keyId,
        name: input.name,
      });
      return key;
    }),

  revoke: orgAdminProcedure
    .input(revokeOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      await getOrgApiKeyForOrg({
        keyId: input.keyId,
        orgId: ctx.auth.identity.orgId,
      });
      const unkey = getUnkeyClient();
      await unkey.keys.updateKey({
        enabled: false,
        keyId: input.keyId,
      });
      log.info("[org-api-keys] revoked", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: input.keyId,
      });
      return { success: true };
    }),

  delete: orgAdminProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      await getOrgApiKeyForOrg({
        keyId: input.keyId,
        orgId: ctx.auth.identity.orgId,
      });
      const unkey = getUnkeyClient();
      await unkey.keys.deleteKey({
        keyId: input.keyId,
        permanent: false,
      });
      log.info("[org-api-keys] deleted", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: input.keyId,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
