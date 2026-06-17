"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@repo/ui-v2/lib/utils";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

const DEFAULT_SCROLL_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';

export interface ScrollEdges {
  bottom: boolean;
  top: boolean;
}

interface ScrollEdgeCuesProps extends Omit<ComponentProps<"div">, "ref"> {
  children: ReactNode;
  viewportSelector?: string;
}

interface UseScrollEdgesOptions {
  viewportSelector?: string;
}

const INITIAL_SCROLL_EDGES: ScrollEdges = {
  bottom: false,
  top: false,
};

export function ScrollEdgeCues({
  children,
  className,
  viewportSelector = DEFAULT_SCROLL_VIEWPORT_SELECTOR,
  ...props
}: ScrollEdgeCuesProps) {
  const { edges, rootRef } = useScrollEdges({ viewportSelector });

  return (
    <div className={cn("relative", className)} ref={rootRef} {...props}>
      {children}
      <ScrollEdgeCue edge="top" visible={edges.top} />
      <ScrollEdgeCue edge="bottom" visible={edges.bottom} />
    </div>
  );
}

export function useScrollEdges({
  viewportSelector = DEFAULT_SCROLL_VIEWPORT_SELECTOR,
}: UseScrollEdgesOptions = {}) {
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<ScrollEdges>(INITIAL_SCROLL_EDGES);
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    setRootElement(node);
  }, []);

  const updateEdges = useCallback(() => {
    const viewport = getScrollViewport(rootElement, viewportSelector);

    if (!viewport) {
      setEdges(INITIAL_SCROLL_EDGES);
      return;
    }

    const maxScrollTop = Math.max(
      viewport.scrollHeight - viewport.clientHeight,
      0,
    );
    const nextEdges = {
      bottom: maxScrollTop - viewport.scrollTop > 1,
      top: viewport.scrollTop > 1,
    };

    setEdges((current) =>
      current.bottom === nextEdges.bottom && current.top === nextEdges.top
        ? current
        : nextEdges,
    );
  }, [rootElement, viewportSelector]);

  useEffect(() => {
    const viewport = getScrollViewport(rootElement, viewportSelector);

    if (!viewport) {
      setEdges(INITIAL_SCROLL_EDGES);
      return;
    }

    updateEdges();
    viewport.addEventListener("scroll", updateEdges, { passive: true });

    const animationFrame = window.requestAnimationFrame(updateEdges);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateEdges);

    resizeObserver?.observe(viewport);

    if (viewport.firstElementChild instanceof HTMLElement) {
      resizeObserver?.observe(viewport.firstElementChild);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      viewport.removeEventListener("scroll", updateEdges);
    };
  }, [rootElement, updateEdges, viewportSelector]);

  return { edges, rootRef };
}

export function ScrollEdgeCue({
  edge,
  visible,
}: {
  edge: "bottom" | "top";
  visible: boolean;
}) {
  const isTop = edge === "top";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex h-8 items-center justify-center text-popover-foreground/45 transition-opacity duration-150",
        isTop
          ? "top-0 bg-gradient-to-b from-popover via-popover/90 to-transparent"
          : "bottom-0 bg-gradient-to-t from-popover via-popover/90 to-transparent",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="size-3"
        icon={isTop ? ChevronUpIcon : ChevronDownIcon}
        strokeWidth={2}
      />
    </div>
  );
}

function getScrollViewport(
  root: HTMLDivElement | null,
  viewportSelector: string,
) {
  return root?.querySelector<HTMLElement>(viewportSelector) ?? root;
}
