"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTRPC } from "@repo/console-trpc/react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { useRealtime } from "@repo/console-upstash-realtime/client";
import type { EventNotification } from "@repo/console-upstash-realtime";
import type { PostTransformEvent } from "@repo/console-providers";
import { EventRow } from "./event-row";
import { useEventFilters } from "./use-event-filters";
import { AGE_PRESET_OPTIONS, dateRangeFromPreset } from "~/components/search-constants";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Search, Radio } from "lucide-react";
import { SOURCE_TYPE_OPTIONS } from "@repo/console-providers/display";

const SOURCE_OPTIONS = [
  { value: "all" as const, label: "All sources" },
  ...SOURCE_TYPE_OPTIONS,
];

interface EventData {
  id: number;
  source: string;
  sourceType: string;
  sourceEvent: PostTransformEvent;
  ingestionSource: string;
  receivedAt: string;
  createdAt: string;
}

interface EventsTableProps {
  orgSlug: string;
  workspaceName: string;
  initialSource?: "github" | "vercel" | "linear" | "sentry";
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
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void setFilters({ search: searchInput });
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
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
    }),
  );

  // Accumulated pages from "load more"
  const [loadedEvents, setLoadedEvents] = useState<EventData[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset accumulation when filters change
  const prevFiltersRef = useRef({ source: filters.source, search: filters.search, age: filters.age });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.source !== filters.source || prev.search !== filters.search || prev.age !== filters.age) {
      setLoadedEvents([]);
      setNextCursor(undefined);
      setLiveEvents([]);
      prevFiltersRef.current = { source: filters.source, search: filters.search, age: filters.age };
    }
  }, [filters.source, filters.search, filters.age]);

  // Effective hasMore / cursor from the latest state
  const effectiveHasMore = nextCursor !== undefined ? nextCursor !== null : data.hasMore;
  const effectiveCursor = nextCursor !== undefined ? nextCursor : data.nextCursor;

  // Live events — only when on default view (no search, no date filter)
  const [liveEvents, setLiveEvents] = useState<EventNotification[]>([]);
  const { organization } = useOrganization();
  const isDefaultView = filters.search === "" && filters.age === "none" && nextCursor === undefined;

  const { status } = useRealtime({
    channels: organization?.id ? [`org-${organization.id}`] : [],
    events: ["workspace.event"],
    enabled: !!organization?.id && isDefaultView,
    onData({ data: notification }) {
      if (notification.workspaceId !== data.workspaceId) return;
      if (source && notification.sourceEvent.source !== source) return;
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB IDs — only recalculates when pages change, not on every live event
  const dbIds = useMemo(
    () => new Set([...data.events.map((e) => e.id), ...loadedEvents.map((e) => e.id)]),
    [data.events, loadedEvents],
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
    if (!effectiveCursor || isLoadingMore) return;
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
        }),
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.source}
          onValueChange={(v) => {
            void setFilters({ source: v as typeof filters.source });
          }}
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
          value={filters.age}
          onValueChange={(v) => {
            void setFilters({ age: v as typeof filters.age });
          }}
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        )}
      </div>

      {/* Table */}
      {allEvents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-8" />
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load more */}
      {effectiveHasMore && allEvents.length > 0 && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
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
      <div className="rounded-full bg-muted/20 p-3 mb-4">
        <Radio className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">No events yet</p>
      <p className="text-sm text-muted-foreground max-w-sm mt-1">
        Events will appear here as webhooks are received from your connected
        sources.
      </p>
    </div>
  );
}
