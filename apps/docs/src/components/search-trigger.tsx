"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSearchContext } from "fumadocs-ui/provider";
import { cn } from "@repo/ui/lib/utils";

interface SearchTriggerProps {
  className?: string;
}

export function SearchTrigger({ className }: SearchTriggerProps) {
  const { setOpenSearch } = useSearchContext();

  return (
    <Button
      variant="outline"
      className={cn("relative w-64 justify-start px-3 py-2", className)}
      onClick={() => setOpenSearch(true)}
    >
      <span className="text-muted-foreground/50 text-xs">
        Search documentation...
      </span>
      <div className="pointer-events-none absolute right-1.5 flex h-6 select-none items-center gap-1 font-mono text-xs font-medium opacity-100">
        <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-xs">
          ⌘
        </kbd>
        <kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-xs">
          K
        </kbd>
      </div>
    </Button>
  );
}
