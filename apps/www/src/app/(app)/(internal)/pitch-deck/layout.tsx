import NextLink from "next/link";
import { cookies } from "next/headers";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { PitchDeckNavbar } from "./_components/pitch-deck-navbar";
import { PitchDeckProvider } from "./_components/pitch-deck-context";
import { PitchDeckLayoutContent } from "./_components/pitch-deck-layout-content";
import { PrefaceToggle } from "./_components/preface-toggle";
import { DownloadButton } from "./_components/download-button";
import { PitchDeckMobileNav } from "./_components/pitch-deck-mobile-nav";

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
        <header className="fixed top-0 left-0 right-0 z-50 py-4 page-gutter">
          <div className="relative flex items-center justify-center">
            {/* Left: Sidebar toggle (absolute positioned) */}
            <div className="absolute left-0 flex items-center">
              <PrefaceToggle />
            </div>

            {/* Desktop: Centered nav pill */}
            <nav className="hidden lg:flex relative h-9 items-center gap-0.5 rounded-md pl-4 pr-1 py-1">
              {/* Glass backdrop layer */}
              <div className="absolute inset-0 rounded-md bg-card/40 border border-border/50 backdrop-blur-md -z-10" />

              {/* Logo */}
              <NextLink
                href="/"
                prefetch
                className="flex items-center mr-auto pr-4"
              >
                <Icons.logoShort className="w-4 h-4 text-foreground/60 hover:text-foreground transition-colors" />
              </NextLink>

              {/* Menu dropdown */}
              <PitchDeckNavbar />

              {/* Contact button */}
              <Button asChild size="sm" className="ml-1">
                <a href="mailto:jp@lightfast.ai">Contact</a>
              </Button>
            </nav>

            {/* Mobile: Logo left, hamburger right */}
            <div className="flex lg:hidden items-center justify-between w-full">
              <NextLink
                href="/"
                prefetch
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <Icons.logoShort className="w-4 h-4 text-foreground" />
              </NextLink>
              <PitchDeckMobileNav />
            </div>

            {/* Right: Download button (absolute positioned) */}
            <div className="absolute right-0 hidden lg:flex items-center">
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
