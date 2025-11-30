"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export function WaitlistCTA() {
  return (
    <section className="flex w-full flex-col items-center justify-center py-32 bg-card rounded-xs text-center">
      <div className="w-full px-4">
        {/* Large heading - similar to Cursor's design */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-foreground mb-12">
          Try Lightfast now.
        </h2>

        {/* CTA Button */}
        <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg">
          <Link href="/early-access">Join Early Access</Link>
        </Button>
      </div>
    </section>
  );
}
