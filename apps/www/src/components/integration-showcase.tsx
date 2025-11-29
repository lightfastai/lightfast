import { IntegrationIcons } from "@repo/ui/integration-icons";

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
    <div className="w-full space-y-8">
      {/* Heading */}
      <div className="text-center">
        <h2 className="text-sm">
          <span className="text-muted-foreground">
            Lightfast integrates with the tools you use
          </span>
        </h2>
      </div>

      {/* Logo Garden Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {integrations.map((integration) => {
          const Icon = IntegrationIcons[integration.slug];
          return (
            <div
              key={integration.slug}
              className="relative flex items-center justify-center"
            >
              <div className="bg-accent/40 border border-border/40 h-[4rem] sm:h-[4.5rem] md:h-[6.25rem] px-3 flex w-full items-center justify-center rounded-xs">
                <Icon
                  className="h-6 sm:h-7 md:h-8 w-auto max-w-[80px] sm:max-w-[100px] md:max-w-[120px] object-contain text-muted-foreground"
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
