import { IntegrationLogoIcons } from "@repo/ui/integration-icons";

const integrations = [
  { name: "GitHub", slug: "github" as const },
  { name: "Notion", slug: "notion" as const },
  { name: "Airtable", slug: "airtable" as const },
  { name: "Linear", slug: "linear" as const },
  { name: "Slack", slug: "slack" as const },
  { name: "Discord", slug: "discord" as const },
  { name: "Sentry", slug: "sentry" as const },
  { name: "PostHog", slug: "posthog" as const },
  { name: "Datadog", slug: "datadog" as const },
  { name: "Vercel", slug: "vercel" as const },
];

export function IntegrationShowcase() {
  return (
    <div className="w-full">
      <span className="mb-4 inline-flex h-7 items-center rounded-md border border-border px-3 text-muted-foreground text-xs">
        Integrations
      </span>
      {/* Logo Garden Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {integrations.map((integration) => {
          const Icon = IntegrationLogoIcons[integration.slug];
          return (
            <div
              className="relative flex items-center justify-center"
              key={integration.slug}
            >
              <div className="flex h-[4rem] w-full items-center justify-center rounded-md border border-border/50 bg-card/40 px-3 backdrop-blur-md sm:h-[4.5rem] md:h-[5rem]">
                <Icon
                  aria-label={`${integration.name} logo`}
                  className="size-6 text-muted-foreground sm:size-7 md:size-8"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
