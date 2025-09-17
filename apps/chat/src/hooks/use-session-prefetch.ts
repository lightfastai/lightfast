"use client";

import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

interface UseSessionPrefetchProps {
  sessionId: string;
  debounceMs?: number;
}

/**
 * Hook that provides a debounced hover handler to prefetch session messages.
 * Only prefetches the heavy message data since other queries (user, usage) are likely cached.
 * Optimized for instant navigation with minimal network overhead.
 */
export function useSessionPrefetch({ 
  sessionId, 
  debounceMs = 300 
}: UseSessionPrefetchProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const prefetchingRef = useRef(false);

  const prefetchSessionData = useCallback(async () => {
    // Prevent duplicate prefetches for the same session
    if (prefetchingRef.current) {
      return;
    }

    prefetchingRef.current = true;
    
    try {
      // Only prefetch if data isn't already fresh in cache
      const queryKey = trpc.message.list.queryOptions({ sessionId }).queryKey;
      const cachedData = queryClient.getQueryData(queryKey);
      const queryState = queryClient.getQueryState(queryKey);
      
      // Skip prefetch if data exists and is still fresh (within staleTime)
      if (cachedData && queryState && Date.now() - queryState.dataUpdatedAt < 30 * 1000) {
        return;
      }

      await queryClient.prefetchQuery({
        ...trpc.message.list.queryOptions({ sessionId }),
        staleTime: 30 * 1000, // Match ExistingSessionChat staleTime
        gcTime: 30 * 60 * 1000, // Match ExistingSessionChat gcTime
      });
    } catch {
      // Prefetch failures should be silent and not affect the UI
      // The existing flow will handle loading if prefetch fails
    } finally {
      prefetchingRef.current = false;
    }
  }, [sessionId, trpc, queryClient]);

  const handleHover = useCallback(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(() => {
      void prefetchSessionData();
    }, debounceMs);
  }, [prefetchSessionData, debounceMs]);

  const handleHoverEnd = useCallback(() => {
    // Cancel pending prefetch if user moves away quickly
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
  }, []);

  // Cleanup timer on unmount
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
  }, []);

  return { handleHover, handleHoverEnd, cleanup };
}