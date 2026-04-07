"use client";

import { useTRPC } from "@repo/app-trpc/react";
import type { EntityNotification } from "@repo/app-upstash-realtime";
import { useRealtime } from "@repo/app-upstash-realtime/client";
import { ENTITY_CATEGORIES } from "@repo/app-validation";
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
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      void setFilters({ search: searchInput });
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput, setFilters]);

  const trpc = useTRPC();

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
  const isDefaultView = filters.search === "" && data.pages.length <= 1;

  // Reset live entities when filters change
  const prevFiltersRef = useRef({
    category: filters.category,
    search: filters.search,
  });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.category !== filters.category || prev.search !== filters.search) {
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
      if (notification.clerkOrgId !== firstPage?.clerkOrgId) {
        return;
      }
      if (category && notification.category !== category) {
        return;
      }
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
                <EntityRow entity={entity} key={entity.externalId} />
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
