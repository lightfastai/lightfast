"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { PageTree } from "fumadocs-core/server";
import { DocsMarketingSidebar } from "./docs-marketing-sidebar";
import { Button } from "@repo/ui/components/ui/button";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { Search } from "./search";
import { DocsHeaderNav } from "./docs-header-nav";
import { authUrl } from "@/src/lib/related-projects";

interface DocsSidebarLayoutProps {
  children: ReactNode;
  tree?: PageTree.Root;
}

/**
 * DocsSidebarLayout - Client component wrapper for docs sidebar UI
 *
 * Handles:
 * - Sidebar state management
 * - Header actions (search, login, github)
 */
export function DocsSidebarLayout({ children, tree }: DocsSidebarLayoutProps) {
  const signInUrl = `${authUrl}/sign-in`;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark flex w-full bg-background h-screen overflow-hidden">
        {/* Docs Marketing Sidebar */}
        <DocsMarketingSidebar tree={tree} />

        {/* Search - Fixed position, centered on viewport */}
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Search />
        </div>

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {/* Header with actions */}
          <header className="shrink-0 py-4 bg-background">
            <div className="page-gutter flex items-center justify-end min-h-[3rem]">
              {/* Right side - Navigation and Sign In Button */}
              <div className="flex items-center gap-4">
                {/* Navigation */}
                <DocsHeaderNav />

                {/* Sign In Button */}
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-full"
                  asChild
                >
                  <Link href={signInUrl}>
                    <span className="text-sm text-secondary-foreground font-medium">
                      Log In
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="page-gutter py-16">
              {/* Page Content */}
              <main className="min-w-0">{children}</main>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
