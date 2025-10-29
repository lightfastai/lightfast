"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useState } from "react";
import type { PageTree } from "fumadocs-core/server";
import { DocsMarketingSidebar } from "./docs-marketing-sidebar";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Menu, X } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { SearchTrigger } from "./search-trigger";
import { LoginDropdown } from "./login-dropdown";
import { DocsMobileMenuSheet } from "./docs-mobile-menu-sheet";
import { getAuthUrls, getAllAppUrls } from "@/src/lib/related-projects";

interface DocsSidebarLayoutProps {
  children: ReactNode;
  tree?: PageTree.Root;
}

/**
 * DocsSidebarLayout - Client component wrapper for docs sidebar UI
 *
 * Handles:
 * - Sidebar state management
 * - Mobile menu toggle
 * - Header actions (search, login, github)
 */
export function DocsSidebarLayout({ children, tree }: DocsSidebarLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const authUrls = getAuthUrls();
  const appUrls = getAllAppUrls();

  const chatSignInUrl = `${authUrls.signIn}?redirect_url=${encodeURIComponent(appUrls.chat)}`;
  const cloudSignInUrl = `${authUrls.signIn}?redirect_url=${encodeURIComponent(appUrls.cloud)}`;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark flex w-full bg-background h-screen overflow-hidden">
        {/* Docs Marketing Sidebar */}
        <DocsMarketingSidebar tree={tree} />

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {/* Header with actions */}
          <header className="shrink-0 py-4 page-gutter-wide bg-background">
            <div className="flex items-center justify-end">
              {/* Action Buttons - Right (from right to left: Menu, Sign In, GitHub, Search) */}
              <div className="flex items-center gap-4">
                {/* Search Button */}
                <SearchTrigger />

                {/* GitHub Link */}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  asChild
                >
                  <Link
                    href="https://github.com/lightfastai/lightfast"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icons.gitHub className="h-5 w-5 text-foreground" />
                    <span className="sr-only">GitHub</span>
                  </Link>
                </Button>

                {/* Sign In Button */}
                <LoginDropdown
                  chatUrl={chatSignInUrl}
                  cloudUrl={cloudSignInUrl}
                />

                {/* Menu Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5 text-foreground" />
                  ) : (
                    <Menu className="h-5 w-5 text-foreground" />
                  )}
                  <span className="sr-only">Menu</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="page-gutter-wide py-16">
              {/* Page Content */}
              <main className="min-w-0">{children}</main>
            </div>
          </div>
        </SidebarInset>

        {/* Mobile Menu Sheet */}
        <DocsMobileMenuSheet
          open={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          tree={tree}
        />
      </div>
    </SidebarProvider>
  );
}
