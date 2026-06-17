import {
  nativeClientSchema,
  nativeCreateAttemptInputSchema,
  nativeFinalizeRequestSchema,
} from "@repo/native-auth-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createNativeAuthAttemptForAuthContext,
  finalizeNativeAuthAttemptForAuthContext,
  getNativeAuthSessionForAuthContext,
  getNativeOAuthClientConfig,
  isNativeAuthError,
  listNativeOrganizationsForAuthContext,
} from "../../native-auth";
import {
  nativeOAuthProcedure,
  publicProcedure,
  viewerProcedure,
} from "../../trpc";

function mapNativeAuthTRPCError(error: unknown): never {
  if (isNativeAuthError(error)) {
    throw new TRPCError({
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const nativeAuthRouter = {
  oauthConfig: publicProcedure
    .input(z.object({ client: nativeClientSchema }))
    .query(({ input }) => {
      try {
        return getNativeOAuthClientConfig({ client: input.client });
      } catch (error) {
        mapNativeAuthTRPCError(error);
      }
    }),

  listOrganizations: viewerProcedure.query(async ({ ctx }) => {
    try {
      return await listNativeOrganizationsForAuthContext({
        auth: ctx.auth,
        db: ctx.db,
      });
    } catch (error) {
      mapNativeAuthTRPCError(error);
    }
  }),

  session: nativeOAuthProcedure.query(async ({ ctx }) => {
    try {
      return await getNativeAuthSessionForAuthContext({
        auth: ctx.auth,
        db: ctx.db,
      });
    } catch (error) {
      mapNativeAuthTRPCError(error);
    }
  }),

  createAttempt: viewerProcedure
    .input(nativeCreateAttemptInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createNativeAuthAttemptForAuthContext({
          auth: ctx.auth,
          data: input,
          db: ctx.db,
        });
      } catch (error) {
        mapNativeAuthTRPCError(error);
      }
    }),

  finalize: nativeOAuthProcedure
    .input(nativeFinalizeRequestSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await finalizeNativeAuthAttemptForAuthContext({
          auth: ctx.auth,
          data: input,
          db: ctx.db,
        });
      } catch (error) {
        mapNativeAuthTRPCError(error);
      }
    }),
} satisfies TRPCRouterRecord;
