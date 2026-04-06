"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Sheet,
  SheetPrimitive,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import type * as PageTree from "fumadocs-core/page-tree";
import { Menu, Search as SearchIcon, X } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ContentLink } from "~/components/content-link";
import { NavLink } from "~/components/nav-link";

interface DocsMobileNavProps {
  activePath?: "docs" | "api";
  apiTree?: PageTree.Root;
  docsTree?: PageTree.Root;
  signInUrl: string;
}

export function DocsMobileNav({
  docsTree,
  apiTree,
  signInUrl,
  activePath = "docs",
}: DocsMobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState<"docs" | "api">(
    activePath
  );
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
      })
    );
  }

  return (
    <div className="flex items-center gap-1 lg:hidden">
      {/* Search icon */}
      <button
        aria-label="Search"
        className="p-2 text-foreground/60 transition-colors hover:text-foreground"
        onClick={openSearch}
        type="button"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {/* Hamburger → nav drawer */}
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>
          <button
            aria-label="Toggle Menu"
            className="p-2 text-foreground/60 transition-colors hover:text-foreground"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>

        <SheetPrimitive.Portal>
          <SheetPrimitive.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in" />
          <SheetPrimitive.Content className="data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex h-full w-[280px] flex-col bg-background data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500">
            <SheetPrimitive.Title className="sr-only">
              Navigation Menu
            </SheetPrimitive.Title>

            {/* Header */}
            <div className="flex h-[4.25rem] shrink-0 items-center justify-between border-border/40 border-b px-4">
              <NavLink href="/" onClick={() => setOpen(false)}>
                <Icons.logoShort className="h-4 w-4 text-foreground" />
              </NavLink>
              <SheetPrimitive.Close className="p-1 text-foreground/60 transition-colors hover:text-foreground">
                <X className="h-5 w-5" />
              </SheetPrimitive.Close>
            </div>

            {/* Docs / API tab switcher */}
            <div className="flex shrink-0 items-center gap-4 border-border/40 border-b px-4 py-3">
              <button
                className={cn(
                  "font-medium text-base transition-colors",
                  selectedTab === "docs"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedTab("docs")}
                type="button"
              >
                Docs
              </button>
              <button
                className={cn(
                  "font-medium text-base transition-colors",
                  selectedTab === "api"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedTab("api")}
                type="button"
              >
                API Reference
              </button>
            </div>

            {/* Navigation tree */}
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 py-4">
                {activeTree?.children.map((item, index) => {
                  if (item.type === "separator") {
                    return (
                      <div key={item.$id ?? `sep-${index}`}>
                        <div className="mb-2 text-muted-foreground text-sm uppercase tracking-wide">
                          {item.name}
                        </div>
                      </div>
                    );
                  }

                  if (item.type === "folder") {
                    return (
                      <div key={item.$id ?? `folder-${index}`}>
                        <div className="mb-2 font-normal text-muted-foreground text-sm">
                          {item.name}
                        </div>
                        <div className="space-y-0.5">
                          {item.children.map((child, childIndex) => {
                            if (child.type === "folder") {
                              return (
                                <div
                                  className="mb-3"
                                  key={
                                    child.$id ?? `child-folder-${childIndex}`
                                  }
                                >
                                  <div className="mb-1 font-medium text-muted-foreground/70 text-sm">
                                    {child.name}
                                  </div>
                                  <div className="ml-2 space-y-0.5">
                                    {child.children.map((page) => {
                                      if (page.type !== "page") {
                                        return null;
                                      }
                                      const isActive = page.url === pathname;
                                      return (
                                        <ContentLink
                                          className={cn(
                                            "block rounded-md px-2 py-1.5 text-base transition-colors",
                                            isActive
                                              ? "bg-accent/70 text-foreground"
                                              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                          )}
                                          href={page.url}
                                          key={page.url}
                                          onClick={() => setOpen(false)}
                                        >
                                          {page.name}
                                        </ContentLink>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (child.type === "page") {
                              const isActive = child.url === pathname;
                              return (
                                <ContentLink
                                  className={cn(
                                    "block rounded-md px-2 py-1.5 text-base transition-colors",
                                    isActive
                                      ? "bg-accent/70 text-foreground"
                                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                  )}
                                  href={child.url}
                                  key={child.url}
                                  onClick={() => setOpen(false)}
                                >
                                  {child.name}
                                </ContentLink>
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
            <div className="shrink-0 border-border/40 border-t p-4">
              <Button asChild className="w-full rounded-full" size="lg">
                <a href={signInUrl} onClick={() => setOpen(false)}>
                  Log In
                </a>
              </Button>
            </div>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      </Sheet>
    </div>
  );
}
