import Link from "next/link";
import { AppNavbar } from "~/components/landing/app-navbar";
import { AppSideNavbar } from "~/components/landing/app-side-navbar";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { CenteredWaitlistSection } from "~/components/landing/centered-waitlist-section";
import { ReadyToOrchestrateSection } from "~/components/landing/ready-to-orchestrate-section";
import { SiteFooter } from "~/components/landing/footer-section";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="manifesto-page flex flex-col bg-background min-h-screen overflow-x-hidden">
      <div className="bg-background">
        {/* Header with navigation */}
        <header className="absolute top-0 left-0 right-0 z-50 px-16">
          <div className="flex pt-8 pb-8 items-center justify-between max-w-7xl mx-auto">
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

            {/* Main navigation tabs - Center */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <AppNavbar />
            </div>

            {/* Action buttons - Right */}
            <div className="ml-auto">
              <AppSideNavbar />
            </div>
          </div>
        </header>

        {children}
      </div>

      {/* Shared footer sections for all marketing pages */}
      {/* Centered Waitlist Section */}
      <div className="bg-background pt-16 px-16 pb-36">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto">
            <CenteredWaitlistSection />
          </div>
        </div>
      </div>

      {/* Ready to Orchestrate Section */}
      <div className="bg-background px-16 py-16">
        <div className="max-w-7xl mx-auto">
          <ReadyToOrchestrateSection />
        </div>
      </div>

      {/* Footer Section */}
      <div className="bg-background py-12 px-16 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
