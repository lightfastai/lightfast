"use client";

import { cn } from "@repo/ui/lib/utils";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Input } from "@repo/ui/components/ui/input";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * TODO: Pre-production improvements for Search component
 *
 * CRITICAL (Must-have before production):
 * - [ ] Add retry mechanism with exponential backoff for failed requests
 * - [ ] Add request timeout (10s default) to prevent hanging
 * - [ ] Improve error messages with specific user actions (retry button, contact support)
 * - [ ] Extract magic numbers to named constants (debounce delay, cache TTL, position offsets)
 * - [ ] Add proper accessibility labels and ARIA attributes
 *
 * HIGH PRIORITY (Should-have for better UX):
 * - [ ] Add loading skeleton instead of just spinner
 * - [ ] Highlight search terms in results
 * - [ ] Show keyboard shortcuts in UI (↑↓ navigate, Enter select, ESC close)
 * - [ ] Handle very long result lists with virtualization
 * - [ ] Add "No results" suggestions or popular searches
 *
 * NICE TO HAVE (Future enhancements):
 * - [ ] Add search analytics/telemetry integration
 * - [ ] Store recent searches in localStorage
 * - [ ] Add search filters or categories
 * - [ ] Support for search operators (quotes, exclude terms)
 * - [ ] Implement server-side result pagination
 * - [ ] Add preview on hover for results
 * - [ ] Support for multiple search providers/indexes
 */

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  snippet?: string;
  score?: number;
  source?: string;
  highlights?: Array<{
    text: string;
    isHighlighted: boolean;
  }>;
}

// Cache for search results
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

export function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Calculate position for results dialog
  const [dialogPosition, setDialogPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  useEffect(() => {
    if (open && searchRef.current) {
      const rect = searchRef.current.getBoundingClientRect();
      setDialogPosition({
        top: rect.bottom + 12, // 12px gap
        left: rect.left - 30, // Offset to make it wider
        width: rect.width + 60, // Make it 60px wider than input
      });
    }
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Focus search with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }

      // Only handle navigation if input is focused
      const isInputFocused = document.activeElement === inputRef.current;

      // Navigate results with arrow keys when open and has results
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

      // Close on Escape only if input is focused
      if (e.key === "Escape" && isInputFocused && open) {
        e.preventDefault();
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router]);

  // Search function with cancellation, caching, and race condition handling
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.results);
      setSelectedIndex(0);
      setError(null);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller and request ID for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/docs/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: abortController.signal,
      });

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return; // A newer request has been initiated, ignore this response
      }

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();

      // Only update if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        const searchResults = data.results || [];

        // Update cache
        searchCache.set(cacheKey, {
          results: searchResults,
          timestamp: Date.now(),
        });

        // Clean up old cache entries
        if (searchCache.size > 50) {
          const entries = Array.from(searchCache.entries());
          entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          searchCache.delete(entries[0][0]);
        }

        setResults(searchResults);
        setSelectedIndex(0);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Only update error state if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setResults([]);
      }
    } finally {
      // Only update loading state if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, []);

  // Debounced search with stable performSearch reference
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is empty or dialog is closed
    if (!searchQuery.trim() || !open) {
      setResults([]);
      setError(null);
      return;
    }

    // Set up new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
    };
  }, [searchQuery, open]); // Remove performSearch dependency since it's stable

  // Reset when dialog closes and cleanup
  useEffect(() => {
    if (!open) {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }

      // Reset state
      setSearchQuery("");
      setResults([]);
      setSelectedIndex(0);
      setError(null);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const showResults =
    open && (results.length > 0 || searchQuery.length > 0 || error);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Search Input - trigger but stays outside dialog */}
      <div
        ref={searchRef}
        className={cn(
          "relative",
          open && "z-50", // Above overlay when dialog is open
        )}
      >
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search documentation"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setOpen(true);
              // Keep focus on input
              requestAnimationFrame(() => {
                inputRef.current?.focus();
              });
            }}
            className={cn(
              "w-[420px] pl-11 pr-20",
              "h-11",
              "transition-all rounded-full border border-border/40",
              "bg-background dark:bg-input/40",
              // Override default input focus styles to remove ring/outline
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "focus-visible:outline-none focus:outline-none",
              "focus-visible:border-border/40", // Keep same border color on focus
            )}
          />
          <div className="absolute right-4 flex items-center gap-1.5 pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded border border-border text-2xs font-medium">
                {open ? "ESC" : "⌘K"}
              </kbd>
            )}
          </div>
        </div>
      </div>

      <Dialog.Portal>
        {/* Dialog Overlay */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
          onClick={() => setOpen(false)}
        />

        {/* Dialog Content - Results positioned below input */}
        {showResults && (
          <Dialog.Content
            onOpenAutoFocus={(e) => {
              // Prevent dialog from stealing focus from input
              e.preventDefault();
            }}
            onEscapeKeyDown={() => setOpen(false)}
            onPointerDownOutside={(e) => {
              // Don't close if clicking on the input
              if (searchRef.current?.contains(e.target as Node)) {
                e.preventDefault();
              } else {
                // Allow closing when clicking outside
                setOpen(false);
              }
            }}
            onInteractOutside={(e) => {
              // Don't close if interacting with the input
              if (searchRef.current?.contains(e.target as Node)) {
                e.preventDefault();
              }
            }}
            className={cn(
              "fixed z-50",
              "bg-background/95 backdrop-blur-sm",
              "border border-border/50 rounded-2xl shadow-2xl",
              "max-h-[420px] overflow-y-auto",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
            )}
            style={{
              top: `${dialogPosition.top}px`,
              left: `${dialogPosition.left}px`,
              width: `${dialogPosition.width}px`,
              maxWidth: "min(480px, 90vw)",
            }}
          >
            <Dialog.Title className="sr-only">Search Results</Dialog.Title>

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
                      // Close dialog when navigating
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
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}