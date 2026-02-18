"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as PageTree from "fumadocs-core/page-tree";
import { Menu, X, Search as SearchIcon } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetPrimitive,
} from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { wwwUrl } from "../lib/related-projects";

interface DocsMobileNavProps {
  docsTree?: PageTree.Root;
  apiTree?: PageTree.Root;
  signInUrl: string;
  activePath?: "docs" | "api";
}

export function DocsMobileNav({
  docsTree,
  apiTree,
  signInUrl,
  activePath = "docs",
}: DocsMobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState<"docs" | "api">(activePath);
  const pathname = usePathname();

  const activeTree = selectedTab === "docs" ? docsTree : apiTree;

  function openSearch() {
    // Trigger the Search component via its existing Cmd+K listener
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }

  return (
    <div className="flex items-center gap-1 lg:hidden">
      {/* Search icon */}
      <button
        className="p-2 text-foreground/60 hover:text-foreground transition-colors"
        aria-label="Search"
        onClick={openSearch}
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {/* Hamburger → nav drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="p-2 text-foreground/60 hover:text-foreground transition-colors"
            aria-label="Toggle Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>

        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 h-full w-[280px] bg-background flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
            <SheetPrimitive.Title className="sr-only">
              Navigation Menu
            </SheetPrimitive.Title>

            {/* Header */}
            <div className="flex items-center justify-between px-4 h-[4.25rem] border-b border-border/40 shrink-0">
              <Link href={wwwUrl} onClick={() => setOpen(false)}>
                <Icons.logoShort className="h-4 w-4 text-foreground" />
              </Link>
              <SheetPrimitive.Close className="p-1 text-foreground/60 hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </SheetPrimitive.Close>
            </div>

            {/* Docs / API tab switcher */}
            <div className="flex items-center gap-4 px-4 py-3 border-b border-border/40 shrink-0">
              <button
                className={cn(
                  "text-base font-medium transition-colors",
                  selectedTab === "docs"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSelectedTab("docs")}
              >
                Docs
              </button>
              <button
                className={cn(
                  "text-base font-medium transition-colors",
                  selectedTab === "api"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSelectedTab("api")}
              >
                API
              </button>
            </div>

            {/* Navigation tree */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-4 space-y-6">
                {activeTree?.children.map((item, index) => {
                  if (item.type === "separator") {
                    return (
                      <div key={item.$id ?? `sep-${index}`}>
                        <div className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
                          {item.name}
                        </div>
                      </div>
                    );
                  }

                  if (item.type === "folder") {
                    return (
                      <div key={item.$id ?? `folder-${index}`}>
                        <div className="text-sm text-muted-foreground font-normal mb-2">
                          {item.name}
                        </div>
                        <div className="space-y-0.5">
                          {item.children.map((child, childIndex) => {
                            if (child.type === "folder") {
                              return (
                                <div
                                  key={
                                    child.$id ?? `child-folder-${childIndex}`
                                  }
                                  className="mb-3"
                                >
                                  <div className="text-sm text-muted-foreground/70 mb-1 font-medium">
                                    {child.name}
                                  </div>
                                  <div className="ml-2 space-y-0.5">
                                    {child.children.map((page) => {
                                      if (page.type !== "page") return null;
                                      const isActive = page.url === pathname;
                                      return (
                                        <Link
                                          key={page.url}
                                          href={page.url}
                                          onClick={() => setOpen(false)}
                                          className={cn(
                                            "block text-base py-1.5 px-2 rounded-md transition-colors",
                                            isActive
                                              ? "text-foreground bg-accent/70"
                                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                                          )}
                                        >
                                          {page.name}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (child.type === "page") {
                              const isActive = child.url === pathname;
                              return (
                                <Link
                                  key={child.url}
                                  href={child.url}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    "block text-base py-1.5 px-2 rounded-md transition-colors",
                                    isActive
                                      ? "text-foreground bg-accent/70"
                                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                                  )}
                                >
                                  {child.name}
                                </Link>
                              );
                            }

                            return null;
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t border-border/40 p-4 shrink-0">
              <Button asChild size="lg" className="w-full rounded-full">
                <Link href={signInUrl} onClick={() => setOpen(false)}>
                  Log In
                </Link>
              </Button>
            </div>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </Sheet>
    </div>
  );
}
