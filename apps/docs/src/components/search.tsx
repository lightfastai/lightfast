"use client";

import { cn } from "@repo/ui/lib/utils";
import {
  Search as SearchIcon,
  Loader2,
  FileText,
  Hash,
  AlignLeft,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@repo/ui/components/ui/input";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDocsSearch } from "~/hooks/use-docs-search";

export function Search() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { search, setSearch, clearSearch, results, isLoading, error } =
    useDocsSearch();

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const resultsList = results === "empty" ? [] : results;

  const handleClose = useCallback(() => {
    setOpen(false);
    clearSearch();
    setSelectedIndex(0);
  }, [clearSearch]);

  // Keyboard shortcuts (capture phase to fire before Radix)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }

      const isInputFocused = document.activeElement === inputRef.current;

      if (e.key === "Escape" && isInputFocused && open) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        inputRef.current?.blur();
        return;
      }

      if (open && resultsList.length > 0 && isInputFocused) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % resultsList.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex(
            (prev) => (prev - 1 + resultsList.length) % resultsList.length,
          );
        } else if (e.key === "Enter" && resultsList[selectedIndex]) {
          e.preventDefault();
          router.push(resultsList[selectedIndex].url);
          handleClose();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, resultsList, selectedIndex, router, handleClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Clear results when popover closes while search has text
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
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-md animate-in fade-in-0"
            onClick={() => handleClose()}
          />,
          document.body,
        )}

      <Popover.Root
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleClose();
            inputRef.current?.blur();
          } else {
            setOpen(true);
          }
        }}
      >
        <Popover.Anchor asChild>
          <div className={cn("relative", open && "z-50")}>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-3 h-4 w-4 text-foreground/60 pointer-events-none z-10" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search documentation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setOpen(true)}
                className={cn(
                  "w-[420px] pl-10 pr-20 h-9",
                  "transition-all rounded-md border border-border/50",
                  "dark:bg-card/40 backdrop-blur-md",
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
              onOpenAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
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

              {!error && resultsList.length === 0 && (
                <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              )}

              {!error && resultsList.length > 0 && (
                <div className="">
                  {resultsList.map((result, index) => (
                    <Link
                      key={result.id}
                      href={result.url}
                      className={cn(
                        "flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors",
                        "hover:bg-muted/40",
                        index === selectedIndex && "bg-muted/60",
                        result.type === "heading" && "pl-7",
                      )}
                      onClick={() => handleClose()}
                      onMouseEnter={() => setSelectedIndex(index)}
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
                            "text-sm text-foreground truncate",
                            result.type === "page" && "font-medium",
                            result.type !== "page" && "font-normal",
                          )}
                        >
                          {result.content}
                        </div>
                        {result.type === "page" && result.source && (
                          <div className="mt-0.5 text-xs text-muted-foreground/60">
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
