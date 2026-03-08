"use client";

import { Icons } from "@repo/ui/components/icons";
import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import type { ComponentType, SVGProps } from "react";

interface Integration {
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  name: string;
}

const latestIntegrations: Integration[] = [
  {
    name: "Linear",
    description:
      "Issue tracking and project management with AI-powered context.",
    Icon: IntegrationLogoIcons.linear,
  },
  {
    name: "Sentry",
    description:
      "Error monitoring and performance tracking for production insights.",
    Icon: IntegrationLogoIcons.sentry,
  },
  {
    name: "Vercel",
    description:
      "Deployment correlation with code changes and rollback intelligence.",
    Icon: IntegrationLogoIcons.vercel,
  },
  {
    name: "PostHog",
    description:
      "Analytics correlation with deployments and feature flag impact analysis.",
    Icon: IntegrationLogoIcons.posthog,
  },
];

export function LatestIntegrations() {
  return (
    <div className="relative sticky top-6 space-y-4 rounded-md p-3 pb-7">
      {/* Glass backdrop layer */}
      <div className="absolute inset-0 -z-10 rounded-md border border-border/50 bg-card/40 backdrop-blur-md" />

      {/* Header */}
      <div className="flex items-center gap-2">
        <Icons.logoShort className="h-3 w-3 text-foreground/60" />
        <h3 className="font-medium text-foreground text-sm">
          Latest Integrations
        </h3>
      </div>

      {/* Description */}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Explore more integrations to expand your development experience.
      </p>

      {/* Integrations list */}
      <div className="space-y-1">
        {latestIntegrations.map((integration) => {
          const Icon = integration.Icon;
          return (
            <div
              className="flex items-center gap-3 py-1.5"
              key={integration.name}
            >
              {/* Icon */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 p-1.5">
                <Icon className="h-full w-full text-foreground/60" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground/80 text-sm">
                  {integration.name}
                </p>
                <p className="line-clamp-1 text-muted-foreground text-xs leading-relaxed">
                  {integration.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
