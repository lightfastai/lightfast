/**
 * Connector Hero Visual Component
 *
 * Horizontal connector icons with center focus and edge clipping.
 * Creates an infinite scroll effect with the middle icon being larger.
 */

import { IntegrationIcons } from "@repo/ui/integration-icons";

const connectors = [
  { name: "Airtable", slug: "airtable" as const },
  { name: "GitHub", slug: "github" as const },
  { name: "Linear", slug: "linear" as const },
  { name: "Sentry", slug: "sentry" as const },
  { name: "PostHog", slug: "posthog" as const },
  { name: "Datadog", slug: "datadog" as const },
  { name: "Vercel", slug: "vercel" as const },
];

export function ConnectorHeroVisual() {
  const middleIndex = Math.floor(connectors.length / 2);

  return (
    <div className="relative bg-card rounded-sm overflow-hidden aspect-[4/3]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 -mx-[15%]">
          {connectors.map((connector, index) => {
            const Icon = IntegrationIcons[connector.slug];
            const isCenter = index === middleIndex;
            const distanceFromCenter = Math.abs(index - middleIndex);

            // Scale down icons further from center
            const sizeClass = isCenter
              ? "w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28"
              : distanceFromCenter === 1
                ? "w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
                : distanceFromCenter === 2
                  ? "w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16"
                  : "w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14";

            return (
              <div
                key={connector.slug}
                className={`flex items-center justify-center shrink-0 ${sizeClass} bg-background rounded-full`}
              >
                <Icon
                  className="w-1/2 h-1/2 text-muted-foreground"
                  aria-label={connector.name}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
