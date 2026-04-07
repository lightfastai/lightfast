# Entity-First UI Rework Implementation Plan

## Overview

Replace the Events page with an Entities page and remove Jobs from the sidebar. Entities become the primary unit of observation — a list of deduplicated, enriched entities extracted from the neural pipeline. Clicking an entity reveals its enriched events (from `orgEvents`, not raw `orgIngestLogs`), related entities (from `orgEntityEdges`), and metadata. The entity backend is fully production-ready; this plan fills the missing tRPC API and UI layers.

## Current State Analysis

**What exists:**
- `orgEntities` table with 12 categories, dedup by `(clerkOrgId, category, key)`, occurrence tracking, state, URL (`db/app/src/schema/tables/org-entities.ts`)
- `orgEventEntities` many-to-many junction with `refLabel` and denormalized `category` (`db/app/src/schema/tables/org-event-entities.ts`)
- `orgEntityEdges` directed entity-to-entity edges with `relationshipType` and `confidence` (`db/app/src/schema/tables/org-entity-edges.ts`)
- `orgEvents` enriched event store with `observationType`, `significanceScore`, `title`, `content` (`db/app/src/schema/tables/org-events.ts`)
- Full neural pipeline: event capture → entity upsert → graph edges → Pinecone embed
- Upstash Realtime for live event feed (`org.event` schema key)
- `platformEventStore` already emits `platform/entity.upserted` Inngest event after entity upsert (`api/platform/src/inngest/functions/platform-event-store.ts:519-533`)

**What's missing:**
- Entity tRPC router (no `entities.ts` in `api/app/src/router/org/`)
- Entity list page (`/{slug}/entities`)
- Entity detail page (`/{slug}/entities/[entityId]`)
- Entity realtime channel for live updates
- All entity UI components (EntityTable, EntityRow, EntityDetail, etc.)

**Descoped (v2):**
- Related entities / entity graph edges UI — `orgEntityEdges` is sparse (only 5 categories generate edges, cross-provider linking is broken). Ship entity detail without it; add when cross-source linking is fixed.

### Key Discoveries:

- Events UI reads `orgIngestLogs` via `trpc.events.list` — raw webhook logs, not enriched events (`api/app/src/router/org/events.ts:2,52-57`)
- `orgEntities` has no Drizzle `relations()` block — traversal to events/edges goes through `orgEventEntities` and `orgEntityEdges` directly (`db/app/src/schema/relations.ts:55-88`)
- Existing indexes support entity list queries: `org_entity_org_category_idx` on `(clerkOrgId, category)`, `org_entity_org_last_seen_idx` on `(clerkOrgId, lastSeenAt)`, and `org_entity_org_key_idx` on `(clerkOrgId, key)` (`db/app/src/schema/tables/org-entities.ts:135-162`)
- Junction table has `org_event_entity_entity_idx` on `entityId` for efficient "all events for entity X" queries (`db/app/src/schema/tables/org-event-entities.ts:61`)
- Entity edges have `org_edge_source_idx` on `(clerkOrgId, sourceEntityId)` and `org_edge_target_idx` on `(clerkOrgId, targetEntityId)` for bidirectional traversal (`db/app/src/schema/tables/org-entity-edges.ts:69-76`)
- tRPC convention: `orgScopedProcedure`, cursor pagination via `limit + 1` sentinel, `satisfies TRPCRouterRecord` (`api/app/src/router/org/events.ts:9-80`)
- Realtime convention: schema defined in `packages/app-upstash-realtime/src/index.ts:9-16`, publisher uses `realtime.channel(\`org-${clerkOrgId}\`).emit(...)` (`api/platform/src/inngest/functions/ingest-delivery.ts:176-190`)
- Sidebar nav defined by `getOrgManageItems()` returning `[Events, Sources, Jobs, Settings]` (`apps/app/src/components/app-sidebar.tsx:55-74`)

## Desired End State

After this plan is complete:

1. The sidebar "Manage" section shows: **Entities, Sources, Settings** (Events and Jobs removed)
2. `/{slug}/entities` shows a paginated, filterable list of all entities for the org, with live prepend when new entities are upserted
3. `/{slug}/entities/[entityId]` shows entity details: header (category, key, state, URL, metrics) and events timeline from `orgEvents` via junction with live prepend
4. The events and jobs page directories are deleted; their tRPC routers and DB tables remain untouched
5. Realtime `org.entity` events power live updates on the entity list; `org.entityEvent` events power live event prepend on entity detail pages

### How to verify:

- Navigate to `/{slug}/entities` — see a list of entities sorted by `lastSeenAt DESC`
- Filter by category and search by key — results update correctly
- Click an entity — navigate to detail page showing header and events
- Trigger a webhook → entity list shows live update (green pulse + new entity appears)
- Open an entity detail page, trigger another webhook for that entity → new event prepends live to the timeline
- Sidebar shows Entities/Sources/Settings only
- `/{slug}/events` and `/{slug}/jobs` return 404
- `pnpm check && pnpm typecheck` pass
- `pnpm build:app` succeeds

## What We're NOT Doing

- **No related entities section** — `orgEntityEdges` is sparse and cross-source linking is broken; deferred to v2
- **No graph visualization** — deferred to v2 alongside related entities
- **No entity editing/deletion** — entities are read-only, managed by the pipeline
- **No entity category prioritization** — all 12 categories shown equally, no structural vs semantic split in UI
- **No changes to the neural pipeline** — `platform-event-store.ts`, `platform-entity-graph.ts`, `platform-entity-embed.ts` remain as-is (realtime publish is added to the existing upsert step, not a new step)
- **No changes to DB schema** — all tables and indexes are sufficient
- **No Drizzle relations changes** — no procedure uses `db.query` relational `with:`, so `orgEntitiesRelations` is unnecessary
- **No removal of events/jobs tRPC routers** — `eventsRouter` and `jobsRouter` stay in the API; they may serve future admin/API use cases
- **No changes to search** — the existing Pinecone search UI remains independent

---

## Phase 1: Entity tRPC Router

### Overview

Create the entity tRPC router with three procedures: `list`, `get`, and `getEvents`. Register it in the app router. (`getRelatedEntities` deferred to v2.)

### Changes Required:

#### 1. Create entity router

**File**: `api/app/src/router/org/entities.ts` (new file)

```typescript
import { db } from "@db/app/client";
import {
  orgEntities,
  orgEventEntities,
  orgEvents,
} from "@db/app/schema";
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

      // Look up entity by externalId using db.select() (matches app router convention)
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

      // Join junction → events, ordered by event occurredAt DESC
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
```

**Convention notes:**
- Uses `db.select().from().where().limit(1)` for lookups — matches all existing `api/app/src/router/org/` routers (never `db.query.*.findFirst()` which is a platform-side convention)
- Search uses `COALESCE` on nullable `value` column to avoid null ilike issues (spike-validated)
- `ilike` search cast to `SQL<unknown>` to satisfy Drizzle's `or()` return type

#### 2. Register router

**File**: `api/app/src/root.ts`
**Changes**: Import and register `entitiesRouter`

```typescript
import { entitiesRouter } from "./router/org/entities";

export const appRouter = createTRPCRouter({
  // User-scoped
  organization: organizationRouter,
  account: accountRouter,
  // Org-scoped
  connections: connectionsRouter,
  entities: entitiesRouter,
  events: eventsRouter,
  jobs: jobsRouter,
  orgApiKeys: orgApiKeysRouter,
});
```

#### 3. Add entity types

**File**: `apps/app/src/types/index.ts`
**Changes**: Add entity type exports from `RouterOutputs`

```typescript
// ============================================================================
// Entities
// ============================================================================

export type EntitiesListResponse = RouterOutputs["entities"]["list"];
export type Entity = EntitiesListResponse["entities"][number];
export type EntityDetail = RouterOutputs["entities"]["get"];
export type EntityEventsResponse = RouterOutputs["entities"]["getEvents"];
export type EntityEvent = EntityEventsResponse["events"][number];
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes (tRPC types resolve end-to-end)
- [x] `pnpm check` passes (lint clean)
- [x] `pnpm build:app` succeeds

#### Manual Verification:

- [ ] Run `pnpm dev:app`, open browser console, call `trpc.entities.list.queryOptions({})` — returns entity data
- [ ] Verify `entities.get` and `entities.getEvents` return expected shapes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Realtime Schema Extension

### Overview

Add two new realtime event types and emit them from `platform-event-store.ts` after entity upsert:
- `org.entity` — entity list live prepend (entity upserted notification)
- `org.entityEvent` — entity detail live prepend (new event linked to a specific entity)

### Changes Required:

#### 1. Extend realtime schema

**File**: `packages/app-upstash-realtime/src/index.ts`
**Changes**: Add `entity` and `entityEvent` event types under the `org` namespace alongside the existing `event` type.

```typescript
import { entityCategorySchema } from "@repo/app-validation";

const schema = {
  org: {
    event: z.object({
      eventId: z.number(),
      clerkOrgId: z.string(),
      sourceEvent: postTransformEventSchema,
    }),
    entity: z.object({
      entityExternalId: z.string(),
      clerkOrgId: z.string(),
      category: entityCategorySchema,
      key: z.string(),
      value: z.string().nullable(),
      state: z.string().nullable(),
      url: z.string().nullable(),
      occurrenceCount: z.number(),
      lastSeenAt: z.string(),
    }),
    entityEvent: z.object({
      entityExternalId: z.string(),
      clerkOrgId: z.string(),
      eventId: z.number(),
      eventExternalId: z.string(),
      observationType: z.string(),
      title: z.string(),
      source: z.string(),
      sourceType: z.string(),
      sourceId: z.string(),
      significanceScore: z.number().nullable(),
      occurredAt: z.string(),
      refLabel: z.string().nullable(),
    }),
  },
};

// Existing exports stay the same
export const realtime = new Realtime({ schema, redis: redis as never });
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;
export type EventNotification = z.infer<typeof schema.org.event>;
export type EntityNotification = z.infer<typeof schema.org.entity>;
export type EntityEventNotification = z.infer<typeof schema.org.entityEvent>;
```

#### 2. Emit entity and entity-event notifications from pipeline

**File**: `api/platform/src/inngest/functions/platform-event-store.ts`
**Changes**: After the `upsert-entities-and-junctions` step (line 502), add a new step to publish both realtime notifications. This runs after `observation` and `entityUpsertResult` are both available.

Fold the realtime publish into the **existing** `"upsert-entities-and-junctions"` step, after the DB writes succeed. Do NOT create a separate `step.run()` — that adds an unnecessary network round-trip per event.

Add at the end of the `"upsert-entities-and-junctions"` step body, after the DB upserts complete and before the `return`:

```typescript
    // Publish to Upstash Realtime for live entity list + entity detail pages
    if (primaryEntityExternalId) {
      const { realtime } = await import("@repo/app-upstash-realtime");
      const channel = realtime.channel(`org-${clerkOrgId}`);

      // 1. Entity list live prepend
      await channel.emit("org.entity", {
        entityExternalId: primaryEntityExternalId,
        clerkOrgId,
        category: sourceEvent.entity.entityType as EntityCategory,
        key: sourceEvent.entity.entityId,
        value: null,
        state: sourceEvent.entity.state ?? null,
        url: sourceEvent.entity.url ?? null,
        occurrenceCount: 1, // Approximate — real count is in DB
        lastSeenAt: sourceEvent.occurredAt,
      } satisfies EntityNotification);

      // 2. Entity detail page live prepend
      await channel.emit("org.entityEvent", {
        entityExternalId: primaryEntityExternalId,
        clerkOrgId,
        eventId: observation.id,
        eventExternalId: observation.externalId,
        observationType: observation.observationType,
        title: observation.title,
        source: observation.source,
        sourceType: observation.sourceType,
        sourceId: observation.sourceId,
        significanceScore: observation.significanceScore,
        occurredAt: observation.occurredAt,
        refLabel: null,
      } satisfies EntityEventNotification);
    }
```

**Note**: Add `EntityNotification` and `EntityEventNotification` to the import from `@repo/app-upstash-realtime` at the top of the file (or use a local `import type`).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app && pnpm build:platform` succeed

#### Manual Verification:

- [ ] Trigger a webhook → verify `org.entity` event is emitted to Upstash Realtime channel (check platform logs for `[event-store] publish-entity-realtime`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Entity List Page

### Overview

Create the `/{slug}/entities` route with a paginated, filterable entity table and live prepend via Upstash Realtime. This replaces the Events page as the primary observation view.

### Changes Required:

#### 1. Entity filters hook

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/_components/use-entity-filters.ts` (new)

```typescript
"use client";

import { entityCategorySchema } from "@repo/app-validation";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

const CATEGORY_OPTIONS = ["all", ...entityCategorySchema.options] as const;
export type EntityCategoryFilter = (typeof CATEGORY_OPTIONS)[number];

export function useEntityFilters() {
  const [filters, setFilters] = useQueryStates(
    {
      category: parseAsStringEnum<EntityCategoryFilter>([
        ...CATEGORY_OPTIONS,
      ]).withDefault("all"),
      search: parseAsString.withDefault(""),
    },
    { history: "replace", shallow: true }
  );

  return { filters, setFilters };
}
```

#### 2. Entity row component

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/_components/entity-row.tsx` (new)

Renders a single entity as a table row. Shows category badge, key (linked if URL exists), state badge, occurrence count, and relative time. Clicking navigates to the entity detail page.

```typescript
"use client";

import type { Entity } from "~/types";
import { Badge } from "@repo/ui/components/ui/badge";
import { TableCell, TableRow } from "@repo/ui/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { useParams, useRouter } from "next/navigation";

interface EntityRowProps {
  entity: Entity;
}

export function EntityRow({ entity }: EntityRowProps) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() =>
        router.push(`/${params.slug}/entities/${entity.externalId}`)
      }
    >
      <TableCell className="py-3">
        <Badge className="font-normal text-xs" variant="outline">
          {entity.category}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[360px] py-3">
        <span className="block truncate font-medium text-sm">
          {entity.key}
        </span>
        {entity.value && (
          <span className="block truncate text-muted-foreground text-xs">
            {entity.value}
          </span>
        )}
      </TableCell>
      <TableCell className="py-3">
        {entity.state && (
          <Badge className="font-normal text-xs" variant="secondary">
            {entity.state}
          </Badge>
        )}
      </TableCell>
      <TableCell className="py-3 text-center text-muted-foreground text-sm tabular-nums">
        {entity.occurrenceCount}
      </TableCell>
      <TableCell className="py-3 text-right text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(entity.lastSeenAt), {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
}
```

#### 3. Entity table component

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/_components/entities-table.tsx` (new)

Client component with:
- Category and search filters via `useEntityFilters`
- `useSuspenseInfiniteQuery` on `trpc.entities.list.infiniteQueryOptions` (matches events-table.tsx pattern exactly — spike-validated)
- Live prepend via `useRealtime` on `org.entity` events
- Built-in "Load more" via `fetchNextPage` / `hasNextPage` from TanStack Query
- Debounced search input

```typescript
"use client";

import type { EntityNotification } from "@repo/app-upstash-realtime";
import { ENTITY_CATEGORIES } from "@repo/app-validation";
import { useTRPC } from "@repo/app-trpc/react";
import { useRealtime } from "@repo/app-upstash-realtime/client";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useOrganization } from "@vendor/clerk/client";
import { Boxes, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Entity } from "~/types";
import { EntityRow } from "./entity-row";
import { useEntityFilters } from "./use-entity-filters";

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...ENTITY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export function EntitiesTable() {
  const { filters, setFilters } = useEntityFilters();
  const category = filters.category === "all" ? undefined : filters.category;

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void setFilters({ search: searchInput });
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput, setFilters]);

  const trpc = useTRPC();

  // Uses useSuspenseInfiniteQuery — matches events-table.tsx pattern exactly
  // TanStack Query manages cursor state, pages, hasNextPage automatically
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.entities.list.infiniteQueryOptions(
        {
          category,
          limit: 30,
          search: filters.search || undefined,
        },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
      )
    );

  const firstPage = data.pages[0];
  const dbEntities = useMemo(
    () => data.pages.flatMap((page) => page.entities),
    [data.pages]
  );

  // Live entities — only when on default view (no search, single page)
  const [liveEntities, setLiveEntities] = useState<EntityNotification[]>([]);
  const { organization } = useOrganization();
  const isDefaultView =
    filters.search === "" && data.pages.length <= 1;

  // Reset live entities when filters change
  const prevFiltersRef = useRef({
    category: filters.category,
    search: filters.search,
  });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.category !== filters.category ||
      prev.search !== filters.search
    ) {
      setLiveEntities([]);
      prevFiltersRef.current = {
        category: filters.category,
        search: filters.search,
      };
    }
  }, [filters.category, filters.search]);

  const { status } = useRealtime({
    channels: firstPage?.clerkOrgId ? [`org-${firstPage.clerkOrgId}`] : [],
    events: ["org.entity"],
    enabled: !!firstPage?.clerkOrgId && isDefaultView,
    onData({ data: notification }) {
      if (notification.clerkOrgId !== firstPage?.clerkOrgId) return;
      if (category && notification.category !== category) return;
      setLiveEntities((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB entity externalIds
  const dbExternalIds = useMemo(
    () => new Set(dbEntities.map((e) => e.externalId)),
    [dbEntities]
  );

  // Merge: live prepend + all pages
  const allEntities = useMemo(() => {
    const newLive = liveEntities.filter(
      (e) => !dbExternalIds.has(e.entityExternalId)
    );
    const liveAsEntities: Entity[] = newLive.map((e) => ({
      id: 0,
      externalId: e.entityExternalId,
      category: e.category,
      key: e.key,
      value: e.value,
      state: e.state,
      url: e.url,
      confidence: null,
      occurrenceCount: e.occurrenceCount,
      lastSeenAt: e.lastSeenAt,
      extractedAt: e.lastSeenAt,
      createdAt: e.lastSeenAt,
    }));
    return [...liveAsEntities, ...dbEntities];
  }, [liveEntities, dbExternalIds, dbEntities]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search entities..."
            value={searchInput}
          />
        </div>

        <Select
          onValueChange={(v) => {
            void setFilters({
              category: v as typeof filters.category,
            });
          }}
          value={filters.category}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {status === "connected" && isDefaultView && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </div>
        )}
      </div>

      {/* Table */}
      {allEntities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="w-[100px]">State</TableHead>
                <TableHead className="w-[80px] text-center">Seen</TableHead>
                <TableHead className="w-[120px] text-right">
                  Last active
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEntities.map((entity) => (
                <EntityRow
                  entity={entity}
                  key={entity.externalId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more — uses TanStack Query's built-in infinite query state */}
      {hasNextPage && allEntities.length > 0 && (
        <div className="flex justify-center py-2">
          <Button
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            variant="outline"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted/20 p-3">
        <Boxes className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">No entities yet</p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        Entities will appear here as events are ingested and processed from your
        connected sources.
      </p>
    </div>
  );
}
```

**Key difference from original plan:** Uses `useSuspenseInfiniteQuery` instead of `useSuspenseQuery` + manual cursor state. This eliminates ~50 lines of `loadedEntities`, `nextCursor`, `isLoadingMore`, `effectiveHasMore` state management that TanStack Query handles automatically. Spike-validated: `infiniteQueryOptions` resolves correctly with the entity router's return shape.

#### 4. Entity list layout (server)

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/layout.tsx` (new)

Prefetches the default entity list view (all categories), wraps in `HydrateClient` + `RealtimeProviderWrapper`. Only prefetches the default view — category switches are client-side fetches (avoids 13 SSR queries).

```typescript
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { RealtimeProviderWrapper } from "@repo/app-upstash-realtime/client";

export default async function EntitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch default view only — category switches are client-side fetches
  prefetch(trpc.entities.list.infiniteQueryOptions({ limit: 30 }, {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  }));

  return (
    <HydrateClient>
      <RealtimeProviderWrapper>{children}</RealtimeProviderWrapper>
    </HydrateClient>
  );
}
```

#### 5. Entity list page (server)

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/page.tsx` (new)

```typescript
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { EntitiesTable } from "./_components/entities-table";

export default function EntitiesPage() {
  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">Entities</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Observed entities extracted from your engineering events.
        </p>
      </div>

      <Suspense fallback={<EntitiesSkeleton />}>
        <EntitiesTable />
      </Suspense>
    </div>
  );
}

function EntitiesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="overflow-hidden rounded-lg border border-border/60">
        {Array.from({ length: 8 }, (_, i) => (
          <div className="border-border/60 border-b px-4 py-3" key={i}>
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-5 w-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app` succeeds

#### Manual Verification:

- [ ] Navigate to `/{slug}/entities` — see entity list sorted by `lastSeenAt DESC`
- [ ] Filter by category dropdown — list filters correctly
- [ ] Type in search — results filter after 300ms debounce
- [ ] Click "Load more" — additional entities append
- [ ] Trigger a webhook → green "Live" pulse indicator visible, new entity prepends to list
- [ ] Click an entity row → navigates to `/{slug}/entities/{externalId}` (404 is expected — detail page is Phase 4)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Entity Detail Page

### Overview

Create the `/{slug}/entities/[entityId]` route showing entity header and events timeline from `orgEvents` with live prepend via `org.entityEvent` realtime. (Related entities deferred to v2.)

### Changes Required:

#### 1. Entity event row component

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/[entityId]/_components/entity-event-row.tsx` (new)

Renders a single event from the entity's timeline. Shows observation type badge, title, source, significance score, and relative time.

```typescript
"use client";

import type { EntityEvent } from "~/types";
import { PROVIDER_DISPLAY } from "@repo/app-providers/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ProviderIcon } from "~/lib/provider-icon";

interface EntityEventRowProps {
  event: EntityEvent;
}

export function EntityEventRow({ event }: EntityEventRowProps) {
  const display = (
    PROVIDER_DISPLAY as Record<
      string,
      (typeof PROVIDER_DISPLAY)[keyof typeof PROVIDER_DISPLAY] | undefined
    >
  )[event.source];

  return (
    <div className="flex items-start gap-3 border-border/60 border-b px-4 py-3 last:border-b-0">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        {display ? (
          <ProviderIcon
            className="h-4 w-4 text-muted-foreground"
            icon={display.icon}
          />
        ) : (
          <div className="h-4 w-4 rounded bg-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{event.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge className="font-normal text-xs" variant="secondary">
            {event.observationType}
          </Badge>
          {event.refLabel && (
            <span className="text-muted-foreground text-xs">
              {event.refLabel}
            </span>
          )}
          {event.significanceScore != null && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {event.significanceScore}%
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(event.occurredAt), {
          addSuffix: true,
        })}
      </span>
    </div>
  );
}
```

#### 2. Entity detail client component

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/[entityId]/_components/entity-detail-view.tsx` (new)

Client component that renders the full entity detail: header and events timeline with live prepend via `org.entityEvent` and infinite query pagination. (Related entities deferred to v2.)

```typescript
"use client";

import type { EntityEventNotification } from "@repo/app-upstash-realtime";
import { useTRPC } from "@repo/app-trpc/react";
import { useRealtime } from "@repo/app-upstash-realtime/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useOrganization } from "@vendor/clerk/client";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { EntityEvent } from "~/types";
import { EntityEventRow } from "./entity-event-row";

interface EntityDetailViewProps {
  entityId: string;
}

export function EntityDetailView({ entityId }: EntityDetailViewProps) {
  const trpc = useTRPC();
  const params = useParams<{ slug: string }>();

  const { data: entity } = useSuspenseQuery(
    trpc.entities.get.queryOptions({ externalId: entityId })
  );

  // Uses useSuspenseInfiniteQuery for events — matches entity list pattern
  const { data: eventsData, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.entities.getEvents.infiniteQueryOptions(
        { externalId: entityId, limit: 20 },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
      )
    );

  const dbEvents = useMemo(
    () => eventsData.pages.flatMap((page) => page.events),
    [eventsData.pages]
  );

  // Live events — prepend new events for this entity in real time
  const [liveEvents, setLiveEvents] = useState<EntityEventNotification[]>([]);
  const { organization } = useOrganization();
  const isDefaultView = eventsData.pages.length <= 1;

  const { status } = useRealtime({
    channels: organization?.id ? [`org-${organization.id}`] : [],
    events: ["org.entityEvent"],
    enabled: !!organization?.id && isDefaultView,
    onData({ data: notification }) {
      if (notification.entityExternalId !== entityId) return;
      if (notification.clerkOrgId !== entity.clerkOrgId) return;
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB event IDs for dedup
  const dbEventIds = useMemo(
    () => new Set(dbEvents.map((e) => e.id)),
    [dbEvents]
  );

  // Merge: live prepend + all pages
  const allEvents = useMemo(() => {
    const newLive = liveEvents.filter((e) => !dbEventIds.has(e.eventId));
    const liveAsEvents: EntityEvent[] = newLive.map((e) => ({
      id: e.eventId,
      externalId: e.eventExternalId,
      observationType: e.observationType,
      title: e.title,
      content: "",
      source: e.source,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      significanceScore: e.significanceScore,
      occurredAt: e.occurredAt,
      refLabel: e.refLabel,
    }));
    return [...liveAsEvents, ...dbEvents];
  }, [liveEvents, dbEventIds, dbEvents]);

  return (
    <div className="space-y-6 pb-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        href={`/${params.slug}/entities`}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Entities
      </Link>

      {/* Entity header */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{entity.category}</Badge>
          {entity.state && (
            <Badge variant="secondary">{entity.state}</Badge>
          )}
        </div>
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">
          {entity.key}
        </h1>
        {entity.value && (
          <p className="mt-1 text-muted-foreground">{entity.value}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-muted-foreground text-sm">
          <span>
            Seen {entity.occurrenceCount}{" "}
            {entity.occurrenceCount === 1 ? "time" : "times"}
          </span>
          <span>
            Last active{" "}
            {formatDistanceToNow(new Date(entity.lastSeenAt), {
              addSuffix: true,
            })}
          </span>
          {entity.url && (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={entity.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3 w-3" />
              View source
            </a>
          )}
        </div>
      </div>

      {/* Events timeline */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold text-lg">Events</h2>
          {status === "connected" && isDefaultView && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Live
            </div>
          )}
        </div>
        {allEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No events linked to this entity yet.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-border/60">
              {allEvents.map((event) => (
                <EntityEventRow event={event} key={event.id} />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center py-3">
                <Button
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                  size="sm"
                  variant="outline"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more events"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

#### 3. Entity detail layout (server)

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/[entityId]/layout.tsx` (new)

Prefetches entity detail + events. Does NOT wrap with `RealtimeProviderWrapper` — the parent `entities/layout.tsx` already provides it. Double-wrapping would cause duplicate WebSocket connections.

```typescript
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";

export default async function EntityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;

  prefetch(trpc.entities.get.queryOptions({ externalId: entityId }));
  prefetch(
    trpc.entities.getEvents.infiniteQueryOptions(
      { externalId: entityId, limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    )
  );

  return <HydrateClient>{children}</HydrateClient>;
}
```

#### 4. Entity detail page (server)

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/entities/[entityId]/page.tsx` (new)

```typescript
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { EntityDetailView } from "./_components/entity-detail-view";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;

  return (
    <Suspense fallback={<EntityDetailSkeleton />}>
      <EntityDetailView entityId={entityId} />
    </Suspense>
  );
}

function EntityDetailSkeleton() {
  return (
    <div className="space-y-6 pb-6">
      <Skeleton className="h-4 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-20" />
        <div className="overflow-hidden rounded-lg border border-border/60">
          {Array.from({ length: 5 }, (_, i) => (
            <div className="border-border/60 border-b px-4 py-3" key={i}>
              <div className="flex items-start gap-3">
                <Skeleton className="mt-0.5 h-5 w-5 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [x] `pnpm build:app` succeeds

#### Manual Verification:

- [ ] Navigate to `/{slug}/entities` → click an entity → detail page loads
- [ ] Entity header shows category, key, state, occurrence count, last active time
- [ ] Events section shows enriched events from `orgEvents` (has `observationType`, `significanceScore`)
- [ ] "Load more events" button works
- [ ] Green "Live" pulse indicator visible next to "Events" heading
- [ ] Trigger a webhook that produces an event for the viewed entity → new event prepends to the timeline in real time
- [ ] "View source" link opens the entity's URL in a new tab
- [ ] Back arrow navigates to entity list

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Navigation & Cleanup

### Overview

Update the sidebar to show Entities instead of Events, remove Jobs, and delete the old Events and Jobs page directories.

### Changes Required:

#### 1. Update sidebar navigation

**File**: `apps/app/src/components/app-sidebar.tsx`
**Changes**: In `getOrgManageItems()` (lines 55-74), replace Events with Entities and remove Jobs.

```typescript
function getOrgManageItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Entities",
      href: `/${orgSlug}/entities`,
      icon: Boxes,
    },
    {
      title: "Sources",
      href: `/${orgSlug}/sources`,
      icon: Plug,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
      icon: Settings,
    },
  ];
}
```

**Note**: Add `Boxes` to the existing lucide-react import. `NavItem` interface requires `icon: React.ComponentType<{ className?: string }>` — omitting it would fail typecheck.

#### 2. Delete events page directory

Delete the entire directory:
```
apps/app/src/app/(app)/(org)/[slug]/(manage)/events/
```

Files removed:
- `events/layout.tsx`
- `events/page.tsx`
- `events/_components/events-table.tsx`
- `events/_components/event-row.tsx`
- `events/_components/event-detail.tsx`
- `events/_components/use-event-filters.ts`

#### 3. Delete jobs page directory

Delete the entire directory:
```
apps/app/src/app/(app)/(org)/[slug]/(manage)/jobs/
```

Files removed:
- `jobs/layout.tsx`
- `jobs/page.tsx`

#### 4. Delete jobs table component

Delete the following files:
- `apps/app/src/components/jobs-table.tsx`
- `apps/app/src/components/use-job-filters.ts`

#### 5. Clean up types

**File**: `apps/app/src/types/index.ts`
**Changes**: Remove the Jobs type exports (lines 13-16) since the Jobs UI is deleted.

Remove:
```typescript
export type JobsListResponse = RouterOutputs["jobs"]["list"];
export type Job = JobsListResponse["items"][number];
export type JobStatus = Job["status"];
```

#### 6. Verify no remaining imports

After deleting files, check for broken imports:
- Search for `from "~/components/jobs-table"` — should have no matches
- Search for `from "~/components/use-job-filters"` — should have no matches
- Search for `JobsTable` or `JobRow` imports — should have no matches
- Search for `EventsTable` or `EventRow` imports from the deleted path — should have no matches

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm typecheck` passes (no broken imports)
- [ ] `pnpm check` passes
- [ ] `pnpm build:app` succeeds
- [ ] No remaining references to deleted files: `grep -r "jobs-table\|use-job-filters\|events-table\|event-row\|event-detail\|use-event-filters" apps/app/src/ --include="*.ts" --include="*.tsx"` returns empty

#### Manual Verification:

- [ ] Sidebar shows: Entities, Sources, Settings (no Events or Jobs)
- [ ] `/{slug}/entities` loads correctly
- [ ] `/{slug}/events` returns 404
- [ ] `/{slug}/jobs` returns 404
- [ ] `/{slug}/entities/{externalId}` loads correctly
- [ ] All other navigation (Ask, Search, Sources, Settings) still works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

No new unit tests required — the entity backend (schema, upsert, graph, embed) is already tested by the neural pipeline. The new tRPC procedures are simple DB reads with no business logic.

### Integration Tests:

- tRPC entity router integration can be verified by running the dev server and calling procedures directly
- Realtime integration tested by triggering a webhook and observing the entity list

### Manual Testing Steps:

1. Start `pnpm dev:full`
2. Navigate to `/{slug}/entities` — verify entity list loads with existing data
3. Filter by category "pr" — verify only PR entities show
4. Search for a known entity key — verify results
5. Click "Load more" — verify additional entities append
6. Click an entity → verify detail page loads with events and related entities
7. Click a related entity → verify navigation to that entity's detail page
8. Trigger a webhook (e.g., GitHub push) → verify new entity appears live in the list
9. Verify sidebar shows Entities, Sources, Settings
10. Verify `/{slug}/events` and `/{slug}/jobs` return 404

## Performance Considerations

- **Entity list query**: Uses `org_entity_org_last_seen_idx` composite index on `(clerkOrgId, lastSeenAt)` for efficient default sort. Category filter uses `org_entity_org_category_idx`. Search uses `ilike` on `key`/`value` — acceptable for current scale, may need full-text search index if entity count grows significantly.
- **Entity events query**: Uses `org_event_entity_entity_idx` on `entityId` for the junction lookup, then joins to `orgEvents`. The `occurredAt` sort is on the joined table — this is efficient for moderate event counts per entity.
- **Layout prefetch**: Prefetches only the default view (1 query) — category switches are client-side fetches. Lighter than the events layout's 5-variant prefetch.
- **Realtime**: Two additional `channel.emit` calls per event store pipeline run (`org.entity` + `org.entityEvent`), folded into the existing `upsert-entities-and-junctions` step. No additional Inngest step or network round-trip. Entity detail page filters `org.entityEvent` client-side by `entityExternalId` — events for other entities are discarded immediately in `onData`.

## Migration Notes

- No database migration required — all tables and indexes exist
- No data migration — entities are already being continuously upserted by the pipeline
- The `eventsRouter` and `jobsRouter` remain in the API for potential future use (admin tools, API access)
- The `orgIngestLogs`, `orgWorkflowRuns` tables remain unchanged

## References

- Research: `thoughts/shared/research/2026-04-05-entity-first-ui-rework-landscape.md`
- Entity schema: `db/app/src/schema/tables/org-entities.ts`
- Entity edges: `db/app/src/schema/tables/org-entity-edges.ts`
- Event-entity junction: `db/app/src/schema/tables/org-event-entities.ts`
- Enriched events: `db/app/src/schema/tables/org-events.ts`
- tRPC router registration: `api/app/src/root.ts`
- Events router (pattern reference): `api/app/src/router/org/events.ts`
- Sidebar navigation: `apps/app/src/components/app-sidebar.tsx:55-74`
- Events table (pattern reference): `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx`
- Upstash Realtime schema: `packages/app-upstash-realtime/src/index.ts`
- Realtime publisher: `api/platform/src/inngest/functions/ingest-delivery.ts:176-190`
- Entity upsert pipeline: `api/platform/src/inngest/functions/platform-event-store.ts`

---

## Improvement Log

**Reviewed: 2026-04-07**

Changes applied after adversarial review with codebase analysis, pattern verification, and spike validation.

### Scope Changes

1. **Related entities removed from v1** — `orgEntityEdges` is sparse (only 5 structural categories generate edges) and cross-source linking is broken. The "Related Entities" section, `getRelatedEntities` procedure, and `related-entity-card.tsx` are all deferred to v2. This removes a file, a procedure, and simplifies the entity detail page.

2. **Drizzle relations change (Phase 1 Step 3) removed entirely** — Without `getRelatedEntities`, no procedure needs `db.query` relational traversal. All procedures use `db.select().from().where()` which doesn't require `orgEntitiesRelations`.

### Bug Fixes

3. **Sidebar `NavItem.icon` was missing** — The plan's Phase 5 omitted the required `icon` field from nav items. `NavItem` at `app-sidebar.tsx:41-45` requires `icon: React.ComponentType<{ className?: string }>`. Added `icon: Boxes` for Entities, kept `Plug`/`Settings` for Sources/Settings.

### Pattern Alignment

4. **Switched from `useSuspenseQuery` to `useSuspenseInfiniteQuery`** — The original plan used `useSuspenseQuery` + ~50 lines of manual cursor state (`loadedEntities`, `nextCursor`, `isLoadingMore`, `effectiveHasMore`). The codebase's established pattern (events-table.tsx:84-97) uses `useSuspenseInfiniteQuery` with `infiniteQueryOptions` which handles all cursor/pagination state automatically. **Spike-validated**: typecheck passes, `data.pages.flatMap(p => p.entities)` resolves correctly, `getNextPageParam` works. Applied to both entity list and entity detail events.

5. **Switched from `db.query.*.findFirst()` to `db.select().from().where().limit(1)`** — All four existing routers in `api/app/src/router/org/` use `db.select()`. `db.query.*` is a platform-side convention. Aligned `get` and `getEvents` procedures.

6. **Search uses `COALESCE` on nullable `value` column** — Original plan used `ilike(orgEntities.value, pattern)` which fails on null values. Spike revealed the fix: `ilike(sql\`COALESCE(\${orgEntities.value}, '')\`, pattern)`.

### Performance

7. **Layout prefetch reduced from 13 to 1 query** — Original prefetched 1 default + 12 category variants. Now prefetches only the default view; category switches are client-side fetches.

8. **Realtime publish folded into existing Inngest step** — Original created a separate `step.run("publish-entity-realtime")`, adding an unnecessary network round-trip per event. Now published at the end of the existing `"upsert-entities-and-junctions"` step.

9. **Removed double `RealtimeProviderWrapper`** — Original wrapped in both `entities/layout.tsx` and `entities/[entityId]/layout.tsx`. Parent layout already provides it; detail layout now uses only `HydrateClient`.

### Spike Evidence

**Hypothesis**: `entities.list` works with `useSuspenseInfiniteQuery` + `infiniteQueryOptions` + live prepend.
**Verdict**: CONFIRMED. 53/53 packages typecheck pass. `infiniteQueryOptions` resolved on first try. Pattern copied 1:1 from events-table.tsx with zero type gymnastics. The manual cursor state management is provably unnecessary.
**Worktree**: `worktree-agent-a52604dc` (5 files, +228/-0 lines)
