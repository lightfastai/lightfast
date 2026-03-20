"use client";

import * as Popover from "@radix-ui/react-popover";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";
import {
  AlignLeft,
  FileText,
  Hash,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDocsSearch } from "~/hooks/use-docs-search";

type SearchAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SELECT"; index: number }
  | { type: "NAVIGATE_DOWN"; max: number }
  | { type: "NAVIGATE_UP"; max: number };

function searchReducer(
  state: { selectedIndex: number; open: boolean },
  action: SearchAction
) {
  switch (action.type) {
    case "OPEN":
      return { ...state, open: true };
    case "CLOSE":
      return { selectedIndex: 0, open: false };
    case "SELECT":
      return { ...state, selectedIndex: action.index };
    case "NAVIGATE_DOWN":
      if (action.max === 0) {
        return state;
      }
      return {
        ...state,
        selectedIndex: (state.selectedIndex + 1) % action.max,
      };
    case "NAVIGATE_UP":
      if (action.max === 0) {
        return state;
      }
      return {
        ...state,
        selectedIndex: (state.selectedIndex - 1 + action.max) % action.max,
      };
  }
}

export function Search() {
  const [{ selectedIndex, open }, dispatch] = useReducer(searchReducer, {
    selectedIndex: 0,
    open: false,
  });

  const { search, setSearch, clearSearch, results, isLoading, error } =
    useDocsSearch();

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const resultsList = results === "empty" ? [] : results;

  const [prevResults, setPrevResults] = useState(results);
  if (prevResults !== results) {
    setPrevResults(results);
    dispatch({ type: "SELECT", index: 0 });
  }

  const handleClose = useCallback(() => {
    dispatch({ type: "CLOSE" });
    clearSearch();
  }, [clearSearch]);

  // Auto-focus input after it becomes visible (needed for mobile: input is
  // display:none until open, so focus() in the keydown handler is a no-op)
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        dispatch({ type: "OPEN" });
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  useEffect(() => {
    if (!open && search) {
      clearSearch();
    }
  }, [open, search, clearSearch]);

  const showResults =
    open && (resultsList.length > 0 || search.trim().length > 0 || error);

  return (
    <>
      {/* Overlay - renders immediately on focus */}
      {open &&
        createPortal(
          <div
            aria-hidden="true"
            className="fade-in-0 fixed inset-0 z-40 animate-in bg-black/20 backdrop-blur-md"
            onClick={() => handleClose()}
          />,
          document.body
        )}

      <Popover.Root
        onOpenChange={(newOpen) => {
          if (newOpen) {
            dispatch({ type: "OPEN" });
          } else {
            handleClose();
            inputRef.current?.blur();
          }
        }}
        open={open}
      >
        <Popover.Anchor asChild>
          <div className={cn("relative", open && "z-50")}>
            {/* Input hidden on mobile until open, always visible on desktop */}
            <div
              className={cn(
                "relative items-center",
                open ? "flex" : "hidden lg:flex"
              )}
            >
              <SearchIcon className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-foreground/60" />
              <Input
                className={cn(
                  "h-9 w-[420px] max-w-[calc(100vw-2rem)] pr-20 pl-10",
                  "rounded-md border border-border/50 transition-all",
                  "backdrop-blur-md dark:bg-card/40",
                  "text-foreground/60",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "focus:outline-none focus-visible:outline-none",
                  "focus-visible:border-border/50"
                )}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => dispatch({ type: "OPEN" })}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && open) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClose();
                    inputRef.current?.blur();
                    return;
                  }
                  if (open && resultsList.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      dispatch({
                        type: "NAVIGATE_DOWN",
                        max: resultsList.length,
                      });
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      dispatch({
                        type: "NAVIGATE_UP",
                        max: resultsList.length,
                      });
                    } else if (
                      e.key === "Enter" &&
                      resultsList[selectedIndex]
                    ) {
                      e.preventDefault();
                      router.push(resultsList[selectedIndex].url);
                      handleClose();
                    }
                  }
                }}
                placeholder="Search documentation"
                ref={inputRef}
                type="text"
                value={search}
              />
              <div className="pointer-events-none absolute right-2 flex items-center gap-1.5">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/60" />
                ) : (
                  <kbd className="hidden items-center gap-1.5 rounded-md border border-border px-1.5 py-0.5 font-medium text-foreground/60 text-sm sm:inline-flex">
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
              align="start"
              alignOffset={0}
              className={cn(
                "z-50",
                "bg-card/40 backdrop-blur-md",
                "rounded-sm border border-border/50 shadow",
                "max-h-[420px] overflow-y-auto",
                "data-[state=closed]:animate-out data-[state=open]:animate-in",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
              )}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onOpenAutoFocus={(e) => e.preventDefault()}
              side="bottom"
              sideOffset={6}
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              {error && (
                <div className="px-4 py-3 text-muted-foreground/70 text-sm">
                  Unable to search at this time
                </div>
              )}

              {!error && resultsList.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 text-muted-foreground/70 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              )}

              {!error && resultsList.length > 0 && (
                <div className="">
                  {resultsList.map((result, index) => (
                    <Link
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors",
                        "hover:bg-muted/40",
                        index === selectedIndex && "bg-muted/60",
                        result.type === "heading" && "pl-7"
                      )}
                      href={result.url}
                      key={result.id}
                      onClick={() => handleClose()}
                      onMouseEnter={() => dispatch({ type: "SELECT", index })}
                    >
                      <span className="mt-0.5 shrink-0 text-muted-foreground/50">
                        {result.type === "page" && (
                          <FileText className="h-4 w-4" />
                        )}
                        {result.type === "heading" && (
                          <Hash className="h-3.5 w-3.5" />
                        )}
                        {result.type === "text" && (
                          <AlignLeft className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "truncate text-foreground text-sm",
                            result.type === "page" && "font-medium",
                            result.type !== "page" && "font-normal"
                          )}
                        >
                          {result.content}
                        </div>
                        {result.type === "page" && result.source && (
                          <div className="mt-0.5 text-muted-foreground/60 text-xs">
                            {result.source}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        )}
      </Popover.Root>
    </>
  );
}
