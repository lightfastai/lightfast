import type { Metadata } from "next";

import { FloatingEarlyAccessClient } from "~/components/early-access/floating-early-access-client";

export const metadata: Metadata = {
  title: "Home",
  description: "Join the waitlist to get early access to Lightfast",
};

export default function Home() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* Pre-container section */}
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6 sm:gap-8">
          <div className="flex flex-col gap-1 text-center">
            <span className="text-foreground -ml-92 text-2xl font-semibold sm:text-5xl">
              Copilot for
            </span>
            <span className="text-foreground font-serif text-8xl font-normal italic">
              Creatives
            </span>
          </div>

          {/* Static description */}
          <div className="max-w-2xl">
            <p className="text-muted-foreground text-center text-sm text-balance sm:text-base">
              The intelligent creative copilot that simplifies the way you
              interact with applications like Blender, Unity, Fusion360 and
              more.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Early Access Chat */}
      <FloatingEarlyAccessClient />
    </div>
  );
}
