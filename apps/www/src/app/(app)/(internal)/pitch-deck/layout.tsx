import Link from "next/link";
import { cookies } from "next/headers";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { PitchDeckNavbar } from "./_components/pitch-deck-navbar";
import { PitchDeckProvider } from "./_components/pitch-deck-context";
import { PitchDeckLayoutContent } from "./_components/pitch-deck-layout-content";
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

            {/* Center: Menu */}
            <PitchDeckNavbar />

            {/* Right: Contact */}
            <div className="md:justify-self-end">
              <a
                href="mailto:jp@lightfast.ai"
                className="text-sm text-foreground hover:text-muted-foreground transition-colors"
              >
                CONTACT
              </a>
            </div>
          </div>
        </header>

        {/* Split Layout with animated transitions */}
        <PitchDeckLayoutContent>{children}</PitchDeckLayoutContent>
      </div>
    </PitchDeckProvider>
  );
}
