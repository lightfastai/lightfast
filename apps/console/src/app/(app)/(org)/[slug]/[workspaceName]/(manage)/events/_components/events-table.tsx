"use client";

import { useOrganization } from "@clerk/nextjs";
import type { PostTransformEvent } from "@repo/console-providers";
import type { ProviderSlug } from "@repo/console-providers/display";
import { SOURCE_TYPE_OPTIONS } from "@repo/console-providers/display";
import { useTRPC } from "@repo/console-trpc/react";
import type { EventNotification } from "@repo/console-upstash-realtime";
import { useRealtime } from "@repo/console-upstash-realtime/client";
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
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Radio, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGE_PRESET_OPTIONS,
  dateRangeFromPreset,
} from "~/components/search-constants";
import { EventRow } from "./event-row";
import { useEventFilters } from "./use-event-filters";

const SOURCE_OPTIONS = [
  { value: "all" as const, label: "All sources" },
  ...SOURCE_TYPE_OPTIONS,
];

interface EventData {
  createdAt: string;
  id: number;
  ingestionSource: string;
  receivedAt: string;
  source: string;
  sourceEvent: PostTransformEvent;
  sourceType: string;
}

interface EventsTableProps {
  initialSource?: ProviderSlug;
  orgSlug: string;
  workspaceName: string;
}

export function EventsTable({
  orgSlug,
  workspaceName,
  initialSource,
}: EventsTableProps) {
  const { filters, setFilters } = useEventFilters(initialSource);
  const source = filters.source === "all" ? undefined : filters.source;

  // Local search input state with debounce
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

  // Derive receivedAfter from age preset
  const receivedAfter = useMemo(() => {
    const range = dateRangeFromPreset(filters.age);
    return range.dateRange?.start;
  }, [filters.age]);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    trpc.workspace.events.list.queryOptions({
      clerkOrgSlug: orgSlug,
      workspaceName,
      source,
      limit: 30,
      search: filters.search || undefined,
      receivedAfter,
    })
  );

  // Accumulated pages from "load more"
  const [loadedEvents, setLoadedEvents] = useState<EventData[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null | undefined>(
    undefined
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset accumulation when filters change
  const prevFiltersRef = useRef({
    source: filters.source,
    search: filters.search,
    age: filters.age,
  });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.source !== filters.source ||
      prev.search !== filters.search ||
      prev.age !== filters.age
    ) {
      setLoadedEvents([]);
      setNextCursor(undefined);
      setLiveEvents([]);
      prevFiltersRef.current = {
        source: filters.source,
        search: filters.search,
        age: filters.age,
      };
    }
  }, [filters.source, filters.search, filters.age]);

  // Effective hasMore / cursor from the latest state
  const effectiveHasMore =
    nextCursor !== undefined ? nextCursor !== null : data.hasMore;
  const effectiveCursor =
    nextCursor !== undefined ? nextCursor : data.nextCursor;

  // Live events — only when on default view (no search, no date filter)
  const [liveEvents, setLiveEvents] = useState<EventNotification[]>([]);
  const { organization } = useOrganization();
  const isDefaultView =
    filters.search === "" && filters.age === "none" && nextCursor === undefined;

  const { status } = useRealtime({
    channels: organization?.id ? [`org-${organization.id}`] : [],
    events: ["workspace.event"],
    enabled: !!organization?.id && isDefaultView,
    onData({ data: notification }) {
      if (notification.workspaceId !== data.workspaceId) {
        return;
      }
      if (source && notification.sourceEvent.source !== source) {
        return;
      }
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB IDs — only recalculates when pages change, not on every live event
  const dbIds = useMemo(
    () =>
      new Set([
        ...data.events.map((e) => e.id),
        ...loadedEvents.map((e) => e.id),
      ]),
    [data.events, loadedEvents]
  );

  // Merge: live prepend + initial page + additional loaded pages
  const allEvents = useMemo(() => {
    const newLive = liveEvents.filter((e) => !dbIds.has(e.eventId));

    const liveAsEvents: EventData[] = newLive.map((e) => ({
      id: e.eventId,
      source: e.sourceEvent.source,
      sourceType: e.sourceEvent.sourceType,
      sourceEvent: e.sourceEvent,
      ingestionSource: "webhook",
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));

    return [...liveAsEvents, ...data.events, ...loadedEvents];
  }, [liveEvents, dbIds, data.events, loadedEvents]);

  const handleLoadMore = async () => {
    if (!effectiveCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result = await queryClient.fetchQuery(
        trpc.workspace.events.list.queryOptions({
          clerkOrgSlug: orgSlug,
          workspaceName,
          source,
          limit: 30,
          cursor: effectiveCursor,
          search: filters.search || undefined,
          receivedAfter,
        })
      );
      setLoadedEvents((prev) => [...prev, ...result.events]);
      setNextCursor(result.hasMore ? result.nextCursor : null);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search events..."
            value={searchInput}
          />
        </div>

        <Select
          onValueChange={(v) => {
            void setFilters({ source: v as typeof filters.source });
          }}
          value={filters.source}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(v) => {
            void setFilters({ age: v as typeof filters.age });
          }}
          value={filters.age}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGE_PRESET_OPTIONS.map((opt) => (
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
      {allEvents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-8" />
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEvents.map((event) => (
                <EventRow event={event} key={event.id} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more */}
      {effectiveHasMore && allEvents.length > 0 && (
        <div className="flex justify-center py-2">
          <Button
            disabled={isLoadingMore}
            onClick={() => void handleLoadMore()}
            variant="outline"
          >
            {isLoadingMore ? "Loading..." : "Load more"}
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
        <Radio className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-sm">No events yet</p>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">
        Events will appear here as webhooks are received from your connected
        sources.
      </p>
    </div>
  );
}
