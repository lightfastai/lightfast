import { db } from "@db/app/client";
import { orgEntities, orgEventEntities, orgEvents } from "@db/app/schema";
import { entityCategorySchema } from "@repo/app-validation";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import type { SQL } from "drizzle-orm";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { orgScopedProcedure } from "../../trpc";

export const entitiesRouter = {
  list: orgScopedProcedure
    .input(
      z.object({
        category: entityCategorySchema.optional(),
        limit: z.number().min(1).max(100).default(30),
        cursor: z.number().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const clerkOrgId = ctx.auth.orgId;
      const { category, limit, cursor, search } = input;

      const conditions = [eq(orgEntities.clerkOrgId, clerkOrgId)];

      if (category) {
        conditions.push(eq(orgEntities.category, category));
      }

      if (cursor) {
        conditions.push(sql`${orgEntities.id} < ${cursor}`);
      }

      if (search) {
        const pattern = `%${search}%`;
        const searchCond = or(
          ilike(orgEntities.key, pattern),
          ilike(sql`COALESCE(${orgEntities.value}, '')`, pattern)
        ) as SQL<unknown>;
        conditions.push(searchCond);
      }

      const rows = await db
        .select()
        .from(orgEntities)
        .where(and(...conditions))
        .orderBy(sql`${orgEntities.id} DESC`)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;

      const entities = items.map((row) => ({
        id: row.id,
        externalId: row.externalId,
        category: row.category,
        key: row.key,
        value: row.value,
        state: row.state,
        url: row.url,
        confidence: row.confidence,
        occurrenceCount: row.occurrenceCount,
        lastSeenAt: row.lastSeenAt,
        extractedAt: row.extractedAt,
        createdAt: row.createdAt,
      }));

      return { entities, hasMore, nextCursor, clerkOrgId };
    }),

  get: orgScopedProcedure
    .input(z.object({ externalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const clerkOrgId = ctx.auth.orgId;

      const rows = await db
        .select()
        .from(orgEntities)
        .where(
          and(
            eq(orgEntities.clerkOrgId, clerkOrgId),
            eq(orgEntities.externalId, input.externalId)
          )
        )
        .limit(1);

      const entity = rows[0];
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found" });
      }

      return entity;
    }),

  getEvents: orgScopedProcedure
    .input(
      z.object({
        externalId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const clerkOrgId = ctx.auth.orgId;
      const { limit, cursor } = input;

      const entityRows = await db
        .select({ id: orgEntities.id })
        .from(orgEntities)
        .where(
          and(
            eq(orgEntities.clerkOrgId, clerkOrgId),
            eq(orgEntities.externalId, input.externalId)
          )
        )
        .limit(1);

      const entity = entityRows[0];
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found" });
      }

      const conditions = [eq(orgEventEntities.entityId, entity.id)];
      if (cursor) {
        conditions.push(sql`${orgEvents.id} < ${cursor}`);
      }

      const rows = await db
        .select({
          event: orgEvents,
          refLabel: orgEventEntities.refLabel,
        })
        .from(orgEventEntities)
        .innerJoin(orgEvents, eq(orgEventEntities.eventId, orgEvents.id))
        .where(and(...conditions))
        .orderBy(desc(orgEvents.occurredAt), desc(orgEvents.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (items.at(-1)?.event.id ?? null) : null;

      return {
        events: items.map((row) => ({
          id: row.event.id,
          externalId: row.event.externalId,
          observationType: row.event.observationType,
          title: row.event.title,
          content: row.event.content,
          source: row.event.source,
          sourceType: row.event.sourceType,
          sourceId: row.event.sourceId,
          significanceScore: row.event.significanceScore,
          occurredAt: row.event.occurredAt,
          refLabel: row.refLabel,
        })),
        hasMore,
        nextCursor,
      };
    }),
} satisfies TRPCRouterRecord;
