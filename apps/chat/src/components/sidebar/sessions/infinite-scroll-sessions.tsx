"use client";

import { useMemo, useCallback } from "react";
import { useInfiniteSessions } from "~/hooks/sidebar/use-infinite-sessions";
import { usePinnedSessions } from "~/hooks/sidebar/use-pinned-sessions";
import { usePinSession } from "~/hooks/sidebar/use-pin-session";
import { useInfiniteScroll } from "~/hooks/sidebar/use-infinite-scroll";
import { flattenPages } from "../utils/session-helpers";
import { SessionsLoadingSkeleton } from "../components/session-skeleton";
import { GroupedSessions } from "./grouped-sessions";

interface InfiniteScrollSessionsProps {
  className?: string;
}

export function InfiniteScrollSessions({ className }: InfiniteScrollSessionsProps) {
  // Data fetching
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteSessions();

  const { data: pinnedSessionsData } = usePinnedSessions();

  // Mutations
  const setPinnedMutation = usePinSession();

  // Process data - handle potentially undefined data
  const allSessions = useMemo(() => {
    return flattenPages(data?.pages);
  }, [data]);
  
  // Filter out pinned sessions from the regular list to avoid duplicates
  const unpinnedSessions = useMemo(() => {
    const pinnedIds = new Set(pinnedSessionsData.map(s => s.id));
    return allSessions.filter(session => !pinnedIds.has(session.id));
  }, [allSessions, pinnedSessionsData]);

  // Handlers
  const handlePinToggle = useCallback((sessionId: string) => {
    const session = unpinnedSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setPinnedMutation.mutate({
      sessionId,
      pinned: !session.pinned,
    });
  }, [unpinnedSessions, setPinnedMutation]);

  // Infinite scroll
  const handleFetchNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  const loadMoreRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    fetchNextPage: handleFetchNextPage,
  });

  // Note: Loading state is handled by Suspense or other means

  // Return null if no sessions
  if (unpinnedSessions.length === 0 && !hasNextPage) {
    return null;
  }

  return (
    <div className={className}>
      <GroupedSessions 
        sessions={unpinnedSessions} 
        onPinToggle={handlePinToggle} 
      />

      {isFetchingNextPage && <SessionsLoadingSkeleton />}
      
      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="h-4 w-full"
          style={{ minHeight: "16px" }}
        />
      )}
    </div>
  );
}