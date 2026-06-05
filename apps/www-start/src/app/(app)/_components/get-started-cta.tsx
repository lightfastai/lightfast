import { Button } from "@repo/ui/components/ui/button";
import { NavLink } from "~/components/nav-link";

export function GetStartedCTA() {
  return (
    <section className="flex w-full flex-col items-center justify-center bg-card py-56 text-center">
      <div className="mx-auto w-full max-w-[1400px] px-8 md:px-16 lg:px-24">
        <h2 className="mb-12 font-normal font-pp text-4xl text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
          Try Lightfast now.
        </h2>

        <Button asChild className="rounded-full text-base" size="xl">
          <NavLink href="/sign-up" microfrontend prefetch>
            Get started
          </NavLink>
        </Button>
      </div>
    </section>
  );
}
