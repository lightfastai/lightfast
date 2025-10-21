import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { AppNavbar } from "~/components/landing/app-navbar";
import { AppSideNavbar } from "~/components/landing/app-side-navbar";

export default function SubpagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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

      {children}
    </>
  );
}
