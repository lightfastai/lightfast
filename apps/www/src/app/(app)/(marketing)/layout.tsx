"use client";

import Link from "next/link";
import { useState } from "react";
import { AppVerticalNav } from "~/components/landing/app-vertical-nav";
import { BrandingMenuSheet } from "~/components/landing/branding-menu-sheet";
import { EarlyAccessCTA } from "~/components/landing/early-access-cta";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Menu, X } from "lucide-react";
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { SiteFooter } from "~/components/landing/footer-section";
import { LightfastSineWaveMatrix } from "~/components/landing/lightfast-sine-wave-matrix";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="dark flex flex-col bg-background min-h-screen overflow-x-hidden">
      <div className="bg-background">
        {/* Header with navigation */}
        <header className="fixed top-0 py-4 left-0 right-0 z-50 px-16 bg-background">
          <div className="flex items-center justify-between mx-auto">
            {/* Logo - Left */}
            <div className="-ml-2 flex items-center">
              <Button
                variant="ghost"
                size="lg"
                className="hover:bg-black group"
                asChild
              >
                <Link href="/">
                  <Icons.logo className="size-22 text-foreground group-hover:text-white transition-colors" />
                </Link>
              </Button>
            </div>

            {/* Sign In and Menu Buttons - Right */}
            <div className="ml-auto flex items-center gap-4">
              {/* Sign In Button */}
              <Button
                variant="outline"
                size="lg"
                className="rounded-full"
                asChild
              >
                <Link href="/sign-in">
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

        {/* Two-column layout: vertical nav + content */}
        <div className="flex pt-32 px-16 gap-8">
          {/* Vertical Navigation - Left Sidebar - Fixed */}
          <aside className="w-64 shrink-0 fixed left-16 top-0 bottom-0 z-40 flex flex-col h-full pt-[30vh] pb-8 gap-8">
            {/* Matrix Animation */}
            <div>
              <LightfastSineWaveMatrix />
            </div>

            <AppVerticalNav />
          </aside>

          {/* Spacer for fixed nav */}
          <div className="w-64 shrink-0"></div>

          {/* Main Content + Footer Sections - Right Column */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Page Content */}
            <main>{children}</main>

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
            <div className="bg-background py-12 sm:py-16 lg:py-24 px-22">
              <SiteFooter />
            </div>
          </div>
        </div>
      </div>

      {/* Menu Sheet */}
      <BrandingMenuSheet open={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </div>
  );
}
