import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";

export function WaitlistCTA() {
  return (
    <section className="flex w-full flex-col items-center justify-center bg-card py-56 text-center">
      <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
        {/* Large heading - similar to Cursor's design */}
        <h2 className="mb-12 font-normal font-pp text-4xl text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Try Lightfast now.
        </h2>

        {/* CTA Button */}
        <Button asChild className="rounded-full text-md" size="xl">
          <MicrofrontendLink href="/early-access" prefetch={true}>
            Join Early Access
          </MicrofrontendLink>
        </Button>
      </div>
    </section>
  );
}
