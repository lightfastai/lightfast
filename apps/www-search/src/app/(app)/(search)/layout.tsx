"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandingMenuSheet } from "~/components/landing/branding-menu-sheet";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Menu, X, Search } from "lucide-react";
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { SiteFooter } from "~/components/landing/footer-section";
import { authUrl } from "~/lib/related-projects";
import { SidebarProvider, SidebarInset } from "@repo/ui/components/ui/sidebar";
import { MarketingSidebar } from "~/components/marketing-sidebar";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="dark flex w-full bg-background h-screen overflow-hidden">
        {/* Marketing Sidebar */}
        <MarketingSidebar />

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {/* Header with actions */}
          <header className="shrink-0 py-4 px-16 bg-background">
            <div className="flex items-center justify-end">
              {/* Action Buttons - Right */}
              <div className="flex items-center gap-4">
                {/* Search Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  asChild
                >
                  <Link href="/search">
                    <Search className="h-5 w-5 text-foreground" />
                    <span className="sr-only">Search</span>
                  </Link>
                </Button>

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
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                  asChild
                >
                  <Link href={`${authUrl}/sign-in`}>
                    <span className="text-xs text-foreground font-medium uppercase tracking-widest">
                      Sign In
                    </span>
                  </Link>
                </Button>

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
            <div className="px-16 py-16">
              {/* Page Content */}
              <main className="min-w-0">{children}</main>

              {/* Shared footer sections for all marketing pages */}
              {/* Centered Waitlist Section */}
              <div className="bg-background pt-16 pb-36">
                <div className="max-w-2xl mx-auto">
                  <CenteredWaitlistSection />
                </div>
              </div>

              {/* Ready to Orchestrate Section */}
              <div className="bg-background py-16">
                <ReadyToOrchestrateSection />
              </div>

              {/* Footer Section */}
              <div className="bg-background px-20 py-12 sm:py-16 lg:py-24">
                <SiteFooter />
              </div>
            </div>
          </div>
        </SidebarInset>

        {/* Menu Sheet */}
        <BrandingMenuSheet open={isMenuOpen} onOpenChange={setIsMenuOpen} />
      </div>
    </SidebarProvider>
  );
}
