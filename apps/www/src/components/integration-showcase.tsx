import { IntegrationIcons } from "@repo/ui/integration-icons";

const integrations = [
  { name: "GitHub", slug: "github" as const, iconClass: "h-7 sm:h-8 md:h-9" },
  { name: "Notion", slug: "notion" as const, iconClass: "h-4.5 sm:h-5 md:h-6" },
  { name: "Airtable", slug: "airtable" as const, iconClass: "h-3 sm:h-3.5 md:h-3.5" },
  { name: "Linear", slug: "linear" as const, iconClass: "h-3.5 sm:h-4 md:h-4.5" },
  { name: "Slack", slug: "slack" as const, iconClass: "h-4 sm:h-4.5 md:h-5.5" },
  { name: "Discord", slug: "discord" as const, iconClass: "h-3 sm:h-3.5 md:h-3.5" },
  { name: "Sentry", slug: "sentry" as const, iconClass: "h-3 sm:h-3.5 md:h-3.5" },
  { name: "PostHog", slug: "posthog" as const, iconClass: "h-3.5 sm:h-4 md:h-4.5" },
  { name: "Datadog", slug: "datadog" as const, iconClass: "h-3.5 sm:h-4 md:h-4.5" },
  { name: "Vercel", slug: "vercel" as const, iconClass: "h-3.5 sm:h-4 md:h-4.5" },
];

export function IntegrationShowcase() {
  return (
    <div className="w-full">
      {/* Logo Garden Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {integrations.map((integration) => {
          const Icon = IntegrationIcons[integration.slug];
          return (
            <div
              key={integration.slug}
              className="relative flex items-center justify-center"
            >
              <div className="bg-card/80 border border-border/50 h-[4rem] sm:h-[4.5rem] md:h-[5rem] px-3 flex w-full items-center justify-center rounded-sm">
                <Icon
                  className={`w-auto ${integration.iconClass} text-muted-foreground`}
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
