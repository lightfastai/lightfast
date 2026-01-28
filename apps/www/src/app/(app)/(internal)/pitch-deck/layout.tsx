import Link from "next/link";
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
        {/* Header - matches marketing navbar alignment */}
        <header className="fixed top-0 left-0 right-0 z-50 py-4 page-gutter bg-background/80 backdrop-blur-sm">
          <div className="relative flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
            {/* Left: Logo + Toggle */}
            <div className="-ml-2 flex items-center gap-1 md:justify-self-start">
              <Button variant="none" size="lg" className="group" asChild>
                <Link href="/" prefetch>
                  <Icons.logo className="size-22 text-foreground transition-colors" />
                </Link>
              </Button>
              <PrefaceToggle />
            </div>

            {/* Center: Menu (desktop only) */}
            <div className="hidden md:block">
              <PitchDeckNavbar />
            </div>

            {/* Right: Download + Contact (desktop) + Mobile Nav */}
            <div className="flex items-center gap-4 md:justify-self-end">
              <DownloadButton />
              <a
                href="mailto:jp@lightfast.ai"
                className="hidden md:block text-sm text-foreground hover:text-muted-foreground transition-colors"
              >
                CONTACT
              </a>
              <PitchDeckMobileNav />
            </div>
          </div>
        </header>

        {/* Split Layout with animated transitions */}
        <PitchDeckLayoutContent>{children}</PitchDeckLayoutContent>
      </div>
    </PitchDeckProvider>
  );
}
