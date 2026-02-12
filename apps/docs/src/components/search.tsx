"use client";

import { cn } from "@repo/ui/lib/utils";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@repo/ui/components/ui/input";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMixedbreadSearch } from "~/hooks/use-mixedbread-search";

export function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { search, results, isLoading, error, clearResults } =
    useMixedbreadSearch();

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }

      const isInputFocused = document.activeElement === inputRef.current;

      if (open && results.length > 0 && isInputFocused) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + results.length) % results.length,
          );
        } else if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          router.push(results[selectedIndex].url);
          setOpen(false);
        }
      }

      if (e.key === "Escape" && isInputFocused && open) {
        e.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchQuery.trim() || !open) {
      clearResults();
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      void search(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
    };
  }, [searchQuery, open, search, clearResults]);

  // Reset when dialog closes - intentional state reset on dialog close
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
      setSearchQuery("");
      clearResults();
      setSelectedIndex(0);
    }
  }, [open, clearResults]);

  // Reset selected index when results change - intentional state sync when results update
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const showResults =
    open && (results.length > 0 || searchQuery.length > 0 || error);

  return (
    <>
      {/* Overlay - renders immediately on open */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md animate-in fade-in-0"
            onClick={() => setOpen(false)}
          />,
          document.body,
        )}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className={cn("relative", open && "z-50")}>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-3 h-4 w-4 text-foreground/60 pointer-events-none z-10" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search documentation"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  setOpen(true);
                  requestAnimationFrame(() => {
                    inputRef.current?.focus();
                  });
                }}
                className={cn(
                  "w-[420px] pl-10 pr-20 h-9",
                  "transition-all rounded-md border border-border/50",
                  "bg-card/40 backdrop-blur-md",
                  "text-foreground/60",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "focus-visible:outline-none focus:outline-none",
                  "focus-visible:border-border/50",
                )}
              />
              <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
                ) : (
                  <kbd className="hidden sm:inline-flex gap-1.5 px-1.5 py-0.5 items-center rounded-md border border-border text-sm font-medium text-foreground/60">
                    {open ? "ESC" : "⌘K"}
                  </kbd>
                )}
              </div>
            </div>
          </div>
        </Popover.Anchor>

        {showResults && (
          <Popover.Portal>
            <Popover.Content
              onOpenAutoFocus={(e) => {
                e.preventDefault();
              }}
              onEscapeKeyDown={() => setOpen(false)}
              onPointerDownOutside={(e) => {
                setOpen(false);
              }}
              onInteractOutside={(e) => {
                e.preventDefault();
              }}
              side="bottom"
              align="start"
              sideOffset={6}
              alignOffset={0}
              className={cn(
                "z-50",
                "bg-card/40 backdrop-blur-md",
                "border border-border/50 rounded-sm shadow",
                "max-h-[420px] overflow-y-auto",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              )}
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              {error && (
                <div className="px-4 py-3 text-sm text-muted-foreground/70">
                  Unable to search at this time
                </div>
              )}

              {!error && !isLoading && results.length === 0 && searchQuery && (
                <div className="px-4 py-3 text-sm text-muted-foreground/70">
                  No results
                </div>
              )}

              {!error && results.length > 0 && (
                <div className="">
                  {results.map((result, index) => (
                    <Link
                      key={result.id}
                      href={result.url}
                      className={cn(
                        "block w-full px-4 py-2.5 text-left transition-colors",
                        "hover:bg-muted/40",
                        index === selectedIndex && "bg-muted/60",
                      )}
                      onClick={() => {
                        setOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="text-sm font-normal text-foreground">
                        {result.title}
                      </div>
                      {result.source && (
                        <div className="mt-0.5 text-xs text-muted-foreground/60">
                          {result.source}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {!error && results.length === 0 && !searchQuery && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/50">
                    Start typing to search...
                  </p>
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        )}
      </Popover.Root>
    </>
  );
}
