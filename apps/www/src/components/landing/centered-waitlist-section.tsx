"use client";

import { WaitlistForm } from "~/app/(app)/(marketing)/_components/(waitlist)/waitlist-form";
import localFont from "next/font/local";

const exposureTrial = localFont({
  src: "../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

export function CenteredWaitlistSection() {
  return (
    <section className="bg-background pt-24 pb-48 px-16">
      <div className="max-w-4xl mx-auto">
        {/* Top text */}
        <p className="text-center text-sm text-muted-foreground mb-12">
          Ready to give it a try?
        </p>

        {/* Main heading */}
        <h2
          className={`text-5xl font-light pt-16 leading-[1.2] tracking-[-0.7] text-foreground text-center mb-4 ${exposureTrial.className}`}
        >
          Get on the list.
        </h2>

        {/* Centered form */}
        <div className="max-w-2xl mx-auto">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
