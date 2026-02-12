"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

export function WaitlistCTA() {
  return (
    <section className="flex w-full flex-col items-center justify-center py-56 bg-card text-center">
      <div className="w-full px-4">
        {/* Large heading - similar to Cursor's design */}
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal text-foreground mb-12 font-pp">
          Try Lightfast now.
        </h2>

        {/* CTA Button */}
        <Button asChild size="xl" className="text-md rounded-full">
          <Link href="/early-access">Join Early Access</Link>
        </Button>
      </div>
    </section>
  );
}
