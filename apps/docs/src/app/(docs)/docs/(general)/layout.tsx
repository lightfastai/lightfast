import type { ReactNode } from "react";
import Link from "next/link";
import { DocsSidebar } from "@/src/components/docs-sidebar";
import { Button } from "@repo/ui/components/ui/button";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { Search } from "@/src/components/search";
import { authUrl } from "@/src/lib/related-projects";
import { pageTree } from "@/src/lib/source";
import { cn } from "@repo/ui/lib/utils";

export default function GeneralDocsLayout({ children }: { children: ReactNode }) {
  const signInUrl = `${authUrl}/sign-in`;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark flex w-full bg-background h-screen overflow-hidden">
        {/* Docs Sidebar */}
        <DocsSidebar tree={pageTree} />

        {/* Search - Fixed position, centered on viewport */}
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Search />
        </div>

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {/* Header with actions */}
          <header className="shrink-0 bg-background">
            <div className="page-gutter flex items-center justify-end min-h-[3rem]">
              {/* Right side - Navigation and Sign In Button */}
              <div className="flex items-center gap-8 py-4">
                {/* Navigation */}
                <nav className="flex items-center gap-6">
                  <Button
                    variant="link"
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-foreground p-0 h-auto",
                      "text-foreground", // Always active in general docs
                    )}
                    asChild
                  >
                    <Link href="/docs/get-started/overview">
                      Docs
                    </Link>
                  </Button>
                  <Button
                    variant="link"
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-foreground p-0 h-auto",
                      "text-muted-foreground", // Never active in general docs
                    )}
                    asChild
                  >
                    <Link href="/docs/api-reference/getting-started/overview">
                      API
                    </Link>
                  </Button>
                </nav>

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
