/**
 * Internal OAuth sub-router.
 *
 * Handles OAuth authorize URL generation, callback processing, and CLI polling.
 * Moved from apps/platform/src/app/api/connect/ route handlers.
 */

import type { SourceType } from "@repo/app-providers";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { buildAuthorizeUrl } from "../../lib/oauth/authorize";
import {
  type CallbackProcessResult,
  processOAuthCallback,
} from "../../lib/oauth/callback";
import { getOAuthResult } from "../../lib/oauth/state";
import { internalProcedure } from "../../trpc";

// ── Router ──────────────────────────────────────────────────────────────────

export const oauthInternalRouter = {
  /**
   * Build OAuth authorize URL for a provider.
   *
   * Generates a cryptographically random state token, stores it in Redis,
   * and returns the authorization URL.
   */
  buildAuthorizeUrl: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        orgId: z.string(),
        connectedBy: z.string(),
        redirectTo: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await buildAuthorizeUrl({
        provider: input.provider as SourceType,
        orgId: input.orgId,
        connectedBy: input.connectedBy,
        redirectTo: input.redirectTo,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
        });
      }

      return { url: result.url, state: result.state };
    }),

  /**
   * Process OAuth callback: validate state, exchange code, upsert installation,
   * persist tokens, store result for CLI polling.
   *
   * Returns CallbackProcessResult — the route handler maps this to HTTP responses
   * (redirect, inline HTML, or error JSON).
   */
  processCallback: internalProcedure
    .input(
      z.object({
        provider: z.string(),
        state: z.string(),
        query: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ input }): Promise<CallbackProcessResult> => {
      return processOAuthCallback({
        provider: input.provider as SourceType,
        state: input.state,
        query: input.query as Record<string, string>,
      });
    }),

  /**
   * Poll for OAuth completion result.
   *
   * Returns the result hash from Redis if the OAuth flow has completed,
   * or null if still pending.
   */
  pollResult: internalProcedure
    .input(
      z.object({
        state: z.string(),
      })
    )
    .query(async ({ input }) => {
      return getOAuthResult(input.state);
    }),
} satisfies TRPCRouterRecord;
