import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { PitchDeckNavbar } from "~/components/pitch-deck-navbar";

export default function PitchDeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 py-2 px-4 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center">
          <Button variant="none" size="lg" className="group" asChild>
            <Link href="/" prefetch>
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </Link>
          </Button>
        </div>

        {/* Center: Menu Toggle - absolutely positioned */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <PitchDeckNavbar />
        </div>

        {/* Right: Contact */}
        <a
          href="mailto:jp@lightfast.ai"
          className="text-sm text-foreground hover:text-muted-foreground transition-colors"
        >
          CONTACT
        </a>
      </header>

      {/* Split Layout */}
      <div className="flex min-h-screen">
        {/* Left Column - Fixed Preface (30%) */}
        <div className="fixed top-0 left-0 w-[30%] h-screen px-8 lg:px-12 bg-background">
          {/* Position to align with slide top: 50vh - (70vw * 9/16 / 2) = 50vh - 19.6875vw */}
          <div className="absolute top-[calc(50vh-19.6875vw)] left-8 lg:left-12 right-8 lg:right-12">
            <div className="max-w-md">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
              A Note from the Founder
            </p>
            <div className="space-y-4 text-sm lg:text-base text-muted-foreground leading-relaxed">
              <p>
                Thank you for taking the time to learn about what we&apos;re building.
              </p>
              <p>
                This deck represents months of conversations with engineers, late nights
                refining our vision, and a genuine belief that we can make a difference
                in how teams work.
              </p>
              <p>
                I&apos;d love to hear your thoughts—whether it&apos;s feedback, questions,
                or just a conversation about where this space is heading.
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm font-medium text-foreground">Jeevan Pillay</p>
              <p className="text-xs text-muted-foreground">Founder, Lightfast</p>
            </div>
            </div>
          </div>
        </div>

        {/* Right Column - Scrollable Pitch Deck (70%) */}
        <div className="ml-[30%] w-[70%] min-h-screen">
          {children}
        </div>
      </div>
    </div>
  );
}
