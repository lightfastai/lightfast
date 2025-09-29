"use client";

import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useTRPC } from "@repo/chat-trpc/react";
import {
  MESSAGE_BACKGROUND_CHAR_BUDGET,
  MESSAGE_FALLBACK_PAGE_SIZE,
  MESSAGE_INITIAL_CHAR_BUDGET,
  MESSAGE_PAGE_GC_TIME,
  MESSAGE_PAGE_STALE_TIME,
} from "~/lib/messages/loading";
import type { ChatRouterOutputs } from "@api/chat";

interface UseScrollAwarePrefetchProps {
  sessionId: string;
  containerSelector?: string;
}

type MessagePage = ChatRouterOutputs["message"]["listInfinite"];
type MessageCursor = NonNullable<MessagePage["nextCursor"]>;
type MessagesInfiniteData = InfiniteData<MessagePage, MessageCursor | null>;

/**
 * Hook that provides scroll-aware hover prefetching.
 * Only prefetches when user shows genuine intent (stopped scrolling + longer hover).
 * Prevents wasted prefetches during rapid scrolling through sidebar items.
 */
export function useScrollAwarePrefetch({ 
  sessionId, 
  containerSelector = '[data-sidebar]'
}: UseScrollAwarePrefetchProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const prefetchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isScrollingRef = useRef(false);
  const prefetchingRef = useRef(false);

  // Detect scrolling state
  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const handleScroll = () => {
      isScrollingRef.current = true;
      
      // Clear any pending prefetches during scroll
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = undefined;
      }

      // Clear existing scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150); // 150ms after scroll stops
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [containerSelector]);

  const prefetchSessionData = useCallback(async () => {
    // Prevent duplicate prefetches
    if (prefetchingRef.current) {
      return;
    }

    prefetchingRef.current = true;
    
    try {
      // Check if data is already fresh
      const listInfiniteOptions = trpc.message.listInfinite.infiniteQueryOptions(
        {
          sessionId,
          limitChars: MESSAGE_INITIAL_CHAR_BUDGET,
          limitMessages: MESSAGE_FALLBACK_PAGE_SIZE,
        },
        {
          initialCursor: null as MessageCursor | null,
          getNextPageParam: (lastPage: Pick<MessagePage, "nextCursor">) =>
            lastPage.nextCursor,
          staleTime: MESSAGE_PAGE_STALE_TIME,
          gcTime: MESSAGE_PAGE_GC_TIME,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          retry: 2,
        },
      );

      const cachedData = queryClient.getQueryData(listInfiniteOptions.queryKey);
      const queryState = queryClient.getQueryState(listInfiniteOptions.queryKey);

      if (cachedData) {
        const totalChars = (cachedData as MessagesInfiniteData).pages.reduce(
          (sum, page) => {
            const pageChars =
              typeof page.pageCharCount === "number"
                ? page.pageCharCount
                : page.items.reduce((innerSum, item) => {
                    const charCount = item.metadata.charCount || 0;
                    return innerSum + charCount;
                  }, 0);

            return sum + pageChars;
          },
          0,
        );

        if (totalChars >= MESSAGE_BACKGROUND_CHAR_BUDGET) {
          return;
        }

        if (
          queryState &&
          Date.now() - queryState.dataUpdatedAt < 30 * 1000
        ) {
          return;
        }
      }

      await queryClient.prefetchInfiniteQuery(listInfiniteOptions);
    } catch {
      // Silent failure
    } finally {
      prefetchingRef.current = false;
    }
  }, [sessionId, trpc, queryClient]);

  const handleHover = useCallback(() => {
    // Clear any existing timer
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = undefined;
    }

    // Don't prefetch if user is actively scrolling
    if (isScrollingRef.current) {
      return;
    }

    // Use longer debounce to ensure genuine intent
    // This prevents prefetching during rapid hover movements
    prefetchTimerRef.current = setTimeout(() => {
      // Double-check user isn't scrolling (race condition protection)
      if (!isScrollingRef.current) {
        void prefetchSessionData();
      }
    }, 600); // 600ms - longer delay ensures genuine hover intent
  }, [prefetchSessionData]);

  const handleHoverEnd = useCallback(() => {
    // Cancel pending prefetch
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = undefined;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = undefined;
    }
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = undefined;
    }
  }, []);

  return { 
    handleHover, 
    handleHoverEnd, 
    cleanup,
    isScrolling: isScrollingRef.current 
  };
}
