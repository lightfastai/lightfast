"use client";

import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import { exposureTrial } from "~/lib/fonts";

export function CenteredWaitlistSection() {
  return (
    <section>
      <div className="mx-auto">
        {/* Top text */}
        <p className="text-center text-sm text-muted-foreground">
          Ready to give it a try?
        </p>

        {/* Main heading */}
        <h2
          className={`text-5xl font-light pt-8 leading-[1.2] tracking-[-0.7] text-foreground text-center mb-16 ${exposureTrial.className}`}
        >
          Get on the list.
        </h2>

        {/* Centered form */}
        <WaitlistForm />
      </div>
    </section>
  );
}
