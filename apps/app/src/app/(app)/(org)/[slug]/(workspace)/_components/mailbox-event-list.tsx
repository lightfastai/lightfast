"use client";

import type { PostTransformEvent } from "@repo/app-providers/contracts";
import { useTRPC } from "@repo/app-trpc/react";
import type { EventNotification } from "@repo/app-upstash-realtime";
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
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SOURCE_TYPE_OPTIONS } from "~/lib/filter-constants";
import type { EventListItem } from "~/types";
import { MailboxEventRow } from "./mailbox-event-row";

const SOURCE_OPTIONS = [
  { value: "all" as const, label: "All" },
  ...SOURCE_TYPE_OPTIONS,
];

export function MailboxEventList() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState<string>("all");
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

  const resolvedSource = source === "all" ? undefined : source;

  const trpc = useTRPC();

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery(
      trpc.events.list.infiniteQueryOptions(
        {
          source: resolvedSource,
          limit: 30,
          search: debouncedSearch || undefined,
        },
        {
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        }
      )
    );

  const firstPage = data.pages[0];
  const dbEvents = useMemo(
    () => data.pages.flatMap((page) => page.events),
    [data.pages]
  );

  // Live events — only when on default view (no search, single page)
  const [liveEvents, setLiveEvents] = useState<EventNotification[]>([]);
  const isDefaultView = debouncedSearch === "" && data.pages.length <= 1;

  // Reset live events when filters change
  const prevFiltersRef = useRef({ source, search: debouncedSearch });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.source !== source || prev.search !== debouncedSearch) {
      setLiveEvents([]);
      prevFiltersRef.current = { source, search: debouncedSearch };
    }
  }, [source, debouncedSearch]);

  const { status } = useRealtime({
    channels: firstPage?.clerkOrgId ? [`org-${firstPage.clerkOrgId}`] : [],
    events: ["org.event"],
    enabled: !!firstPage?.clerkOrgId && isDefaultView,
    onData({ data: notification }) {
      if (notification.clerkOrgId !== firstPage?.clerkOrgId) {
        return;
      }
      if (
        resolvedSource &&
        notification.sourceEvent.provider !== resolvedSource
      ) {
        return;
      }
      setLiveEvents((prev) => [notification, ...prev]);
    },
  });

  // Stable set of DB IDs
  const dbIds = useMemo(() => new Set(dbEvents.map((e) => e.id)), [dbEvents]);

  // Merge: live prepend + all pages
  const allEvents = useMemo(() => {
    const newLive = liveEvents.filter((e) => !dbIds.has(e.eventId));

    const liveAsEvents: EventListItem[] = newLive.map((e) => ({
      id: e.eventId,
      source: e.sourceEvent.provider,
      sourceType: e.sourceEvent.eventType,
      sourceEvent: e.sourceEvent as PostTransformEvent,
      ingestionSource: "webhook",
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));

    return [...liveAsEvents, ...dbEvents];
  }, [liveEvents, dbIds, dbEvents]);

  return (
    <div className="flex flex-col">
      {/* Filter row */}
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <Select onValueChange={setSource} value={source}>
          <SelectTrigger className="h-7 w-24 text-xs">
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
      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Radio className="mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-muted-foreground text-xs">No events yet</p>
        </div>
      ) : (
        <div className="space-y-0.5 p-1">
          {allEvents.map((event) => (
            <MailboxEventRow event={event} key={event.id} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && allEvents.length > 0 && (
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
