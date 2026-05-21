import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";

import { isClerkResourceNotFound } from "../../auth/clerk-errors";
import { orgAdminProcedure, orgProcedure } from "../../trpc";

/**
 * Organization API Keys Router (Clerk-backed)
 *
 * Thin wrapper over `clerkClient.apiKeys.*`. Keys are minted, listed, revoked
 * and deleted via Clerk's first-party API Keys primitive. The full secret is
 * only present on `create` — surface it once and never read it again.
 */
export const orgApiKeysRouter = {
  list: orgProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const { data } = await clerk.apiKeys.list({
      subject: ctx.auth.identity.orgId,
      includeInvalid: true,
    });
    // Spread Clerk's APIKey class instances into plain objects — RSC props
    // serialization rejects class instances at the prefetch → hydrate boundary.
    return data.map((k) => ({ ...k }));
  }),

  create: orgAdminProcedure
    .input(createOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const key = await clerk.apiKeys.create({
        name: input.name,
        subject: ctx.auth.identity.orgId,
        createdBy: ctx.auth.identity.userId,
        secondsUntilExpiration: input.secondsUntilExpiration ?? null,
      });
      log.info("[org-api-keys] created", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: key.id,
        name: input.name,
      });
      // key.secret is only present on create. Spread into a plain object so
      // the mutation result survives RSC serialization on the way to the UI.
      return { ...key };
    }),

  revoke: orgAdminProcedure
    .input(revokeOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      let existing;
      try {
        existing = await clerk.apiKeys.get(input.keyId);
      } catch (err) {
        if (isClerkResourceNotFound(err)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }
        throw err;
      }
      if (existing.subject !== ctx.auth.identity.orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }
      let key;
      try {
        key = await clerk.apiKeys.revoke({
          apiKeyId: input.keyId,
          revocationReason: input.revocationReason ?? null,
        });
      } catch (err) {
        if (isClerkResourceNotFound(err)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }
        throw err;
      }
      log.info("[org-api-keys] revoked", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: key.id,
      });
      return { success: true };
    }),

  delete: orgAdminProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      let existing;
      try {
        existing = await clerk.apiKeys.get(input.keyId);
      } catch (err) {
        if (isClerkResourceNotFound(err)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }
        throw err;
      }
      if (existing.subject !== ctx.auth.identity.orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }
      await clerk.apiKeys.delete(input.keyId);
      log.info("[org-api-keys] deleted", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: input.keyId,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
