import { Button } from "@repo/ui/components/ui/button";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { DocsMobileNav } from "~/app/(docs)/_components/docs-mobile-nav";
import { DocsSidebar } from "~/app/(docs)/_components/docs-sidebar";
import { Search } from "~/app/(docs)/_components/search";
import { buildApiPageTree } from "~/app/(docs)/_lib/build-api-tree";
import { pageTree } from "~/app/(docs)/_lib/source";
import { consoleUrl } from "~/lib/related-projects";

export default function GeneralDocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const signInUrl = `${consoleUrl}/sign-in`;
  const apiTree = buildApiPageTree();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark flex h-screen w-full overflow-hidden bg-background">
        {/* Docs Sidebar */}
        <DocsSidebar tree={pageTree} />

        {/* Search - Fixed position, centered on viewport */}
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform">
          <Search />
        </div>

        {/* Main Content Area */}
        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          {/* Header with actions */}
          <header className="page-gutter shrink-0 bg-transparent py-4">
            <div className="flex h-9 items-center">
              {/* Left - Mobile Nav (hamburger + sheet drawer) */}
              <DocsMobileNav
                activePath="docs"
                apiTree={apiTree}
                docsTree={pageTree}
                signInUrl={signInUrl}
              />

              {/* Right side - Navigation and Sign In Button */}
              <div className="ml-auto flex items-center gap-6">
                {/* Navigation */}
                <nav className="flex items-center gap-6">
                  <Button
                    asChild
                    className={cn(
                      "h-auto p-0 font-medium text-sm transition-colors hover:text-foreground",
                      "text-foreground" // Always active in general docs
                    )}
                    variant="link"
                  >
                    <Link href="/docs/get-started/overview">Docs</Link>
                  </Button>
                  <Button
                    asChild
                    className={cn(
                      "h-auto p-0 font-medium text-sm transition-colors hover:text-foreground",
                      "text-muted-foreground" // Never active in general docs
                    )}
                    variant="link"
                  >
                    <Link href="/docs/api-reference/getting-started/overview">
                      API
                    </Link>
                  </Button>
                </nav>

                {/* Sign In Button */}
                <Button
                  asChild
                  className="rounded-full"
                  size="lg"
                  variant="secondary"
                >
                  <Link href={signInUrl}>
                    <span className="font-medium text-secondary-foreground text-sm">
                      Log In
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="page-gutter py-8">
              {/* Page Content */}
              <main className="min-w-0">{children}</main>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
