"use client";

import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

interface DocsSidebarScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * DocsSidebarScrollArea - Scroll area with dynamic border that appears when scrolling
 *
 * Features:
 * - Shows top border when content is scrolled down
 * - Smooth opacity transition for border appearance
 * - Wraps Radix UI ScrollArea with scroll detection
 */
export function DocsSidebarScrollArea({
  children,
  className,
}: DocsSidebarScrollAreaProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (!scrollElement) return;

    const handleScroll = () => {
      setIsScrolled(scrollElement.scrollTop > 0);
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Dynamic border - only visible when scrolled */}
      <div
        className={cn(
          "border-t transition-opacity duration-200",
          isScrolled
            ? "border-border opacity-100"
            : "border-transparent opacity-0",
        )}
      />
      <ScrollArea ref={scrollAreaRef} className={className}>
        {children}
      </ScrollArea>
    </>
  );
}
