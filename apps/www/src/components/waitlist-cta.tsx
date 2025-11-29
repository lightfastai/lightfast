"use client";

import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import { exposureTrial } from "~/lib/fonts";

export function WaitlistCTA() {
  return (
    <section className="flex w-full flex-col items-center text-center">
      <div className="w-full px-4">
        {/* Small label - matching hero section */}
        <div className="mb-8 opacity-80">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Ready to give it a try?
          </p>
        </div>

        {/* Heading - matching hero section sizing */}
        <h2
          className={`text-3xl sm:text-4xl md:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-balance text-foreground text-center ${exposureTrial.className}`}
        >
          Get on the list.
        </h2>

        {/* Form with matching spacing */}
        <div className="mt-8 max-w-2xl mx-auto">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
