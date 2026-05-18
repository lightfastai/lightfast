import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";

import { pendingNotAllowedProcedure } from "../../trpc";

function isClerkNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  if ("status" in err && (err as { status?: number }).status === 404) {
    return true;
  }
  const errs = (err as { errors?: { code?: string }[] }).errors;
  return (
    Array.isArray(errs) && errs.some((e) => e.code === "resource_not_found")
  );
}

/**
 * Organization API Keys Router (Clerk-backed)
 *
 * Thin wrapper over `clerkClient.apiKeys.*`. Keys are minted, listed, revoked
 * and deleted via Clerk's first-party API Keys primitive. The full secret is
 * only present on `create` — surface it once and never read it again.
 */
export const orgApiKeysRouter = {
  list: pendingNotAllowedProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const { data } = await clerk.apiKeys.list({
      subject: ctx.auth.identity.orgId,
      includeInvalid: true,
    });
    // Spread Clerk's APIKey class instances into plain objects — RSC props
    // serialization rejects class instances at the prefetch → hydrate boundary.
    return data.map((k) => ({ ...k }));
  }),

  create: pendingNotAllowedProcedure
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

  revoke: pendingNotAllowedProcedure
    .input(revokeOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      let key;
      try {
        key = await clerk.apiKeys.revoke({
          apiKeyId: input.keyId,
          revocationReason: input.revocationReason ?? null,
        });
      } catch (err) {
        if (isClerkNotFound(err)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "API key not found",
          });
        }
        throw err;
      }
      if (key.subject !== ctx.auth.identity.orgId) {
        // Defense-in-depth: Clerk doesn't scope revoke by subject. Reject so
        // org A cannot revoke org B's keys by guessing IDs.
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }
      log.info("[org-api-keys] revoked", {
        clerkOrgId: ctx.auth.identity.orgId,
        keyId: key.id,
      });
      return { success: true };
    }),

  delete: pendingNotAllowedProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      let existing;
      try {
        existing = await clerk.apiKeys.get(input.keyId);
      } catch (err) {
        if (isClerkNotFound(err)) {
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
