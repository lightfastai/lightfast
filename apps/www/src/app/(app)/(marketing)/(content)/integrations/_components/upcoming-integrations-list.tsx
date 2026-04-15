import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { Route } from "next";
import { getIntegrationPages } from "~/app/(app)/(content)/_lib/source";
import { NavLink } from "~/components/nav-link";

export function UpcomingIntegrationsList() {
  const planned = getIntegrationPages()
    .filter((page) => page.data.status === "planned")
    .sort((a, b) => a.data.title.localeCompare(b.data.title));

  return (
    <section className="mt-24">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-16">
        {/* Left: Badge */}
        <div>
          <span className="inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-sm">
            Roadmap
          </span>
        </div>

        {/* Right: Upcoming integrations - spans 2 columns */}
        <div className="lg:col-span-2">
          <div className="mb-8 flex items-baseline justify-between border-border border-b pb-8">
            <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
              Upcoming integrations.
            </p>
            <span className="text-muted-foreground text-sm">
              {planned.length} planned
            </span>
          </div>

          <ul className="divide-y divide-border/50 overflow-hidden rounded-md border border-border/50 bg-accent/20">
            {planned.map((page) => {
              const slug = page.slugs[0] ?? "";
              const Icon = IntegrationLogoIcons[page.data.iconKey];
              return (
                <li key={slug}>
                  <NavLink
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40 md:px-6"
                    href={`/integrations/${slug}` as Route}
                    prefetch
                  >
                    <Icon
                      aria-hidden
                      className="size-4 shrink-0 text-foreground"
                    />
                    <div className="flex min-w-0 flex-1 items-baseline gap-3">
                      <span className="shrink-0 font-medium text-foreground text-sm">
                        {page.data.title}
                      </span>
                      <span className="truncate text-muted-foreground text-sm">
                        {page.data.tagline}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-sm border border-border/50 bg-background px-2 py-0.5 text-muted-foreground text-xs">
                      Planned
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
