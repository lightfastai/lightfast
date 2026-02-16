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
      <span className="inline-flex items-center h-7 px-3 rounded-md border border-border text-xs text-muted-foreground mb-4">
        Integrations
      </span>
      {/* Logo Garden Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {integrations.map((integration) => {
          const Icon = IntegrationLogoIcons[integration.slug];
          return (
            <div
              key={integration.slug}
              className="relative flex items-center justify-center"
            >
              <div className="bg-card/40 border border-border/50 backdrop-blur-md h-[4rem] sm:h-[4.5rem] md:h-[5rem] px-3 flex w-full items-center justify-center rounded-md">
                <Icon
                  className="size-6 sm:size-7 md:size-8 text-muted-foreground"
                  aria-label={`${integration.name} logo`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
