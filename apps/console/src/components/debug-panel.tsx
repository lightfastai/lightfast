"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useDrag } from "@use-gesture/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { DebugPanelContent } from "./debug-panel-content";

const EDGE_MARGIN = 16;
const BUTTON_SIZE = 36;
const POS_STORAGE_KEY = "debug-panel-pos";

function viewportWidth() {
  return document.documentElement.clientWidth;
}

function viewportHeight() {
  return document.documentElement.clientHeight;
}

export function DebugPanel({ slug, workspaceName }: { slug: string; workspaceName: string }) {
  const [open, setOpen] = useState(false);
  const [pos, _setPos] = useState(() => {
    if (typeof window === "undefined") return { x: 0, y: EDGE_MARGIN };
    try {
      const saved = sessionStorage.getItem(POS_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch { /* ignore */ }
    return { x: viewportWidth() - BUTTON_SIZE - EDGE_MARGIN, y: EDGE_MARGIN };
  });
  const setPos = useCallback((p: { x: number; y: number }) => {
    _setPos(p);
    try { sessionStorage.setItem(POS_STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, []);
  const [snapping, setSnapping] = useState(false);
  const didDrag = useRef(false);

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.max(0, Math.min(viewportWidth() - BUTTON_SIZE, x)),
    y: Math.max(0, Math.min(viewportHeight() - BUTTON_SIZE, y)),
  }), []);

  const popoverSide = useMemo((): "right" | "left" => {
    const vw = typeof window !== "undefined" ? viewportWidth() : 1000;
    return pos.x < vw / 2 ? "right" : "left";
  }, [pos.x]);

  const popoverAlign = useMemo((): "start" | "end" => {
    const vh = typeof window !== "undefined" ? viewportHeight() : 1000;
    return pos.y < vh / 2 ? "start" : "end";
  }, [pos.y]);

  interface DragMemo { x: number; y: number }

  const bind = useDrag(
    ({ down, movement: [mx, my], first, memo }: { down: boolean; movement: [number, number]; first: boolean; memo?: DragMemo }) => {
      if (open) return;
      if (first) {
        didDrag.current = false;
        setSnapping(false);
        memo = { x: pos.x, y: pos.y };
      }
      if (!memo) return;

      if (Math.abs(mx) + Math.abs(my) > 4) {
        didDrag.current = true;
      }

      const clamped = clamp(memo.x + mx, memo.y + my);

      if (down) {
        setPos(clamped);
      } else if (!didDrag.current) {
        setOpen(true);
      } else {
        const vw = viewportWidth();
        const vh = viewportHeight();
        const snapX = clamped.x < (vw - BUTTON_SIZE) / 2
          ? EDGE_MARGIN
          : vw - BUTTON_SIZE - EDGE_MARGIN;
        const snapY = Math.max(EDGE_MARGIN, Math.min(vh - BUTTON_SIZE - EDGE_MARGIN, clamped.y));
        setSnapping(true);
        setPos({ x: snapX, y: snapY });
      }

      return memo;
    },
    { filterTaps: false },
  );

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        transition: snapping
          ? "left 300ms cubic-bezier(0.4, 0, 0.2, 1), top 300ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "none",
      }}
    >
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Anchor asChild>
          <Button
            {...bind()}
            variant="outline"
            size="icon"
            className="rounded-full bg-black touch-none select-none cursor-grab active:cursor-grabbing"
            title="Open Debug Panel"
          >
            <Icons.logoShort className="size-3 text-white" />
          </Button>
        </PopoverPrimitive.Anchor>
        {/* No Portal — content renders inline within the fixed container */}
        <PopoverPrimitive.Content
          side={popoverSide}
          align={popoverAlign}
          sideOffset={8}
          avoidCollisions={false}
          sticky="always"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-80 bg-black border-white/10 backdrop-blur-sm shadow-2xl text-white p-0 font-mono text-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 origin-(--radix-popover-content-transform-origin) rounded-md border shadow-md outline-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <Icons.logoShort className="size-3 text-white" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-white/50 hover:text-white/90 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              <X className="size-3" />
            </Button>
          </div>
          <DebugPanelContent slug={slug} workspaceName={workspaceName} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>
    </div>
  );
}
