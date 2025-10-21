import Link from "next/link";
import { AppNavbar } from "~/components/landing/app-navbar";
import { AppSideNavbar } from "~/components/landing/app-side-navbar";
import { ManifestoGrid } from "~/components/landing/manifesto-grid";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";

export default function ManifestoPage() {
  return (
    <div className="manifesto-page bg-background flex flex-col h-screen">
      {/* Header with navigation */}
      <header className="absolute top-0 left-0 right-0 flex px-16 pt-8 pb-8 items-center justify-between z-10">
        {/* Logo - Left */}
        <div className="-ml-2">
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
      </header>

      {/* Manifesto Grid - Centered */}
      <div className="flex items-center justify-center flex-1">
        <div className="w-full h-full px-96 py-72 manifesto">
          <div className="p-12 h-full w-full rounded-sm bg-background">
            <ManifestoGrid />
          </div>
        </div>
      </div>
    </div>
  );
}
