import { db } from "@db/app/client";
import { orgIngestLogs } from "@db/app/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, eq, gte, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { orgScopedProcedure } from "../../trpc";

export const eventsRouter = {
  list: orgScopedProcedure
    .input(
      z.object({
        source: z.string().optional(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.number().optional(),
        search: z.string().optional(),
        receivedAfter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // No error handling: pure DB read. Sentry's trpcMiddleware captures
      // failures with full stack + input context. A manual log.error here
      // would be redundant and increase BetterStack noise.
      const clerkOrgId = ctx.auth.orgId;
      const { source, limit, cursor, search, receivedAfter } = input;

      const conditions = [eq(orgIngestLogs.clerkOrgId, clerkOrgId)];

      if (source) {
        conditions.push(
          sql`(${orgIngestLogs.sourceEvent}->>'provider') = ${source}`
        );
      }

      if (cursor) {
        conditions.push(sql`${orgIngestLogs.id} < ${cursor}`);
      }

      if (receivedAfter) {
        conditions.push(gte(orgIngestLogs.receivedAt, receivedAfter));
      }

      if (search) {
        const pattern = `%${search}%`;
        const searchCond = or(
          ilike(sql`(${orgIngestLogs.sourceEvent}->>'title')`, pattern),
          ilike(sql`(${orgIngestLogs.sourceEvent}->>'eventType')`, pattern)
        ) as SQL<unknown>;
        conditions.push(searchCond);
      }

      const rows = await db
        .select()
        .from(orgIngestLogs)
        .where(and(...conditions))
        .orderBy(sql`${orgIngestLogs.id} DESC`)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;

      const events = items.map((row) => ({
        id: row.id,
        source: row.sourceEvent.provider,
        sourceType: row.sourceEvent.eventType,
        sourceEvent: row.sourceEvent,
        ingestionSource: row.ingestionSource,
        receivedAt: row.receivedAt,
        createdAt: row.createdAt,
      }));

      return {
        events,
        hasMore,
        nextCursor,
        clerkOrgId,
      };
    }),
} satisfies TRPCRouterRecord;
