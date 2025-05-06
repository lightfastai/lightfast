import { useCallback, useEffect, useState } from "react";

/**
 * Hook to manage scroll-to-bottom functionality for chat interfaces
 */
export function useScrollToBottom() {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  // Determine if the user is at the bottom of the scroll container
  const checkIfAtBottom = useCallback(() => {
    if (!containerRef) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef;
    const scrollPosition = scrollTop + clientHeight;
    const threshold = 100; // pixels from bottom to consider "at bottom"

    const atBottom = scrollHeight - scrollPosition <= threshold;
    setIsAtBottom(atBottom);
  }, [containerRef]);

  // Function to scroll to the bottom of the container
  const scrollToBottom = useCallback(() => {
    if (!containerRef) return;

    containerRef.scrollTo({
      top: containerRef.scrollHeight,
      behavior: "smooth",
    });
  }, [containerRef]);

  // Add scroll listener to track position
  useEffect(() => {
    if (!containerRef) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    containerRef.addEventListener("scroll", handleScroll);

    // Initial check
    checkIfAtBottom();

    return () => {
      containerRef.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, checkIfAtBottom]);

  return {
    isAtBottom,
    scrollToBottom,
    containerRef: setContainerRef as (ref: HTMLDivElement | null) => void,
    checkIfAtBottom,
  };
}
