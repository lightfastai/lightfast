import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { cookies } from "next/headers";
import NextLink from "next/link";
import { DownloadButton } from "./_components/download-button";
import { PitchDeckProvider } from "./_components/pitch-deck-context";
import { PitchDeckLayoutContent } from "./_components/pitch-deck-layout-content";
import { PitchDeckMobileNav } from "./_components/pitch-deck-mobile-nav";
import { PitchDeckNavbar } from "./_components/pitch-deck-navbar";
import { PrefaceToggle } from "./_components/preface-toggle";

export default async function PitchDeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read preface state from cookies (server-side)
  const cookieStore = await cookies();
  const prefaceCookie = cookieStore.get("pitch_deck_preface");
  const defaultPrefaceExpanded = prefaceCookie?.value !== "false";

  return (
    <PitchDeckProvider defaultPrefaceExpanded={defaultPrefaceExpanded}>
      <div className="relative min-h-screen bg-background">
        {/* Header - navbar-v2 style */}
        <header className="page-gutter fixed top-0 right-0 left-0 z-50 py-4">
          <div className="relative flex items-center justify-center">
            {/* Left: Sidebar toggle (absolute positioned) */}
            <div className="absolute left-0 flex items-center">
              <PrefaceToggle />
            </div>

            {/* Desktop: Centered nav pill */}
            <nav className="relative hidden h-9 items-center gap-0.5 rounded-md py-1 pr-1 pl-4 md:flex">
              {/* Glass backdrop layer */}
              <div className="absolute inset-0 -z-10 rounded-md border border-border/50 bg-card/40 backdrop-blur-md" />

              {/* Logo */}
              <NextLink
                className="mr-auto flex items-center pr-4"
                href="/"
                prefetch
              >
                <Icons.logoShort className="h-4 w-4 text-foreground/60 transition-colors hover:text-foreground" />
              </NextLink>

              {/* Menu dropdown */}
              <PitchDeckNavbar />

              {/* Contact button */}
              <Button asChild className="ml-1" size="sm">
                <a href="mailto:jp@lightfast.ai">Contact</a>
              </Button>
            </nav>

            {/* Mobile: Logo left, hamburger right */}
            <div className="flex w-full items-center justify-between md:hidden">
              <NextLink
                className="flex items-center transition-opacity hover:opacity-80"
                href="/"
                prefetch
              >
                <Icons.logoShort className="h-4 w-4 text-foreground" />
              </NextLink>
              <PitchDeckMobileNav />
            </div>

            {/* Right: Download button (absolute positioned) */}
            <div className="absolute right-0 hidden items-center md:flex">
              <DownloadButton />
            </div>
          </div>
        </header>

        {/* Split Layout with animated transitions */}
        <PitchDeckLayoutContent>{children}</PitchDeckLayoutContent>
      </div>
    </PitchDeckProvider>
  );
}
