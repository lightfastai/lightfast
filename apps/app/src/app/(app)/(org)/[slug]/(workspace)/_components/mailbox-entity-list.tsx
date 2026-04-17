"use client";

import { useTRPC } from "@repo/app-trpc/react";
import type { EntityNotification } from "@repo/app-upstash-realtime";
import { useRealtime } from "@repo/app-upstash-realtime/client";
import { ENTITY_CATEGORIES, type EntityCategory } from "@repo/app-validation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Entity } from "~/types";
import { MailboxEntityRow } from "./mailbox-entity-row";

type CategoryFilter = EntityCategory | "all";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...ENTITY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export function MailboxEntityList() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput]);

  const resolvedCategory: EntityCategory | undefined =
    category === "all" ? undefined : category;

  const trpc = useTRPC();

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.entities.list.infiniteQueryOptions(
        {
          category: resolvedCategory,
          limit: 30,
          search: debouncedSearch || undefined,
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
  const isDefaultView = debouncedSearch === "" && data.pages.length <= 1;

  // Reset live entities when filters change
  const prevFiltersRef = useRef({ category, search: debouncedSearch });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.category !== category || prev.search !== debouncedSearch) {
      setLiveEntities([]);
      prevFiltersRef.current = { category, search: debouncedSearch };
    }
  }, [category, debouncedSearch]);

  const { status } = useRealtime({
    channels: firstPage?.clerkOrgId ? [`org-${firstPage.clerkOrgId}`] : [],
    events: ["org.entity"],
    enabled: !!firstPage?.clerkOrgId && isDefaultView,
    onData({ data: notification }) {
      if (notification.clerkOrgId !== firstPage?.clerkOrgId) {
        return;
      }
      if (resolvedCategory && notification.category !== resolvedCategory) {
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
    <div className="flex flex-col">
      {/* Filter row */}
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <Select
          onValueChange={(v) => setCategory(v as CategoryFilter)}
          value={category}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
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
        <Input
          className="h-7 flex-1 text-xs"
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search..."
          value={searchInput}
        />
        {status === "connected" && isDefaultView && (
          <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
        )}
      </div>

      {/* List */}
      {allEntities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Boxes className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">No entities yet</p>
        </div>
      ) : (
        <div className="space-y-0.5 p-1">
          {allEntities.map((entity) => (
            <MailboxEntityRow entity={entity} key={entity.externalId} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && allEntities.length > 0 && (
        <div className="flex justify-center border-t py-2">
          <Button
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            size="sm"
            variant="ghost"
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
