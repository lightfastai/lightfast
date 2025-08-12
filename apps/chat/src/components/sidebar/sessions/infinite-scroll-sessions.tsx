"use client";

import { useMemo, useCallback } from "react";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { useInfiniteSessions } from "~/hooks/sidebar/use-infinite-sessions";
import { usePinSession } from "~/hooks/sidebar/use-pin-session";
import { useInfiniteScroll } from "~/hooks/sidebar/use-infinite-scroll";
import { splitSessionsByPinned, flattenPages } from "../utils/session-helpers";
import { SessionsLoadingSkeleton } from "../components/session-skeleton";
import { EmptyState } from "../components/empty-state";
import { PinnedSessions } from "./pinned-sessions";
import { GroupedSessions } from "./grouped-sessions";

interface InfiniteScrollSessionsProps {
  className?: string;
}

export function InfiniteScrollSessions({ className }: InfiniteScrollSessionsProps) {
  // Data fetching with regular useInfiniteQuery
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
  
  const { pinnedSessions, unpinnedSessions } = useMemo(
    () => splitSessionsByPinned(allSessions),
    [allSessions]
  );

  // Handlers
  const handlePinToggle = useCallback((sessionId: string) => {
    const session = allSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setPinnedMutation.mutate({
      sessionId,
      pinned: !session.pinned,
    });
  }, [allSessions, setPinnedMutation]);

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

  // Handle empty state
  if (allSessions.length === 0) {
    return <EmptyState className={className} />;
  }

  return (
    <ScrollArea className={className}>
      <div className="w-full max-w-full min-w-0 overflow-hidden pr-2">
        <PinnedSessions 
          sessions={pinnedSessions} 
          onPinToggle={handlePinToggle} 
        />
        
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
    </ScrollArea>
  );
}