"use client";

import { useMemo, useCallback } from "react";
import { useInfiniteSessions } from "~/hooks/use-infinite-sessions";
import { usePinSession } from "~/hooks/use-pin-session";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
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

  // Mutations
  const setPinnedMutation = usePinSession();

  // Process data - handle potentially undefined data
  const allSessions = useMemo(() => {
    return flattenPages(data?.pages);
  }, [data]);
  
  // Filter to only show unpinned sessions
  // The backend returns all sessions, we filter client-side to exclude pinned ones
  const sessions = useMemo(() => {
    return allSessions.filter(session => !session.pinned);
  }, [allSessions]);

  // Handlers
  const handlePinToggle = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setPinnedMutation.mutate({
      sessionId,
      pinned: !session.pinned,
    });
  }, [sessions, setPinnedMutation]);

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
  if (sessions.length === 0 && !hasNextPage) {
    return null;
  }

  return (
    <div className={className}>
      <GroupedSessions 
        sessions={sessions} 
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