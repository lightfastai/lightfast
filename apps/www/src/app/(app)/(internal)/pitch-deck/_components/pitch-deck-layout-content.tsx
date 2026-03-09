"use client";

import { cn } from "@repo/ui/lib/utils";
import { usePitchDeck } from "./pitch-deck-context";

interface PitchDeckLayoutContentProps {
  children: React.ReactNode;
}

export function PitchDeckLayoutContent({
  children,
}: PitchDeckLayoutContentProps) {
  const { prefaceExpanded } = usePitchDeck();

  return (
    <div className="flex min-h-screen">
      {/* Left Column - Founder Preface */}
      <div
        className={cn(
          "fixed top-0 left-0 z-30 h-screen w-[30%] bg-background",
          "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          prefaceExpanded
            ? "translate-x-0 opacity-100"
            : "-translate-x-full opacity-0"
        )}
      >
        <div className="page-gutter h-full w-full">
          {/* Position content to align with slide center */}
          <div className="absolute top-1/2 right-8 left-8 -translate-y-1/2 md:right-16 md:left-16">
            <div className="max-w-md">
              <p className="mb-4 text-muted-foreground text-xs uppercase tracking-wider">
                A Note from the Founder
              </p>
              <div className="space-y-4 text-muted-foreground text-sm leading-relaxed md:text-base">
                <p>
                  Thank you for taking the time to learn about what we&apos;re
                  building.
                </p>
                <p>
                  This deck represents months of conversations with engineers,
                  late nights refining our vision, and a genuine belief that we
                  can make a difference in how teams work.
                </p>
                <p>
                  I&apos;d love to hear your thoughts—whether it&apos;s
                  feedback, questions, or just a conversation about where this
                  space is heading.
                </p>
              </div>
              <div className="mt-8 border-border border-t pt-6">
                <p className="font-medium text-foreground text-sm">
                  Jeevan Pillay
                </p>
                <p className="text-muted-foreground text-xs">
                  Founder, Lightfast
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Slides */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          prefaceExpanded ? "ml-[30%] w-[70%]" : "ml-0 w-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}
