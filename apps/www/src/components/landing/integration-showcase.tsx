"use client";

import { useEffect, useState } from "react";
import { IntegrationIcons } from "@repo/ui/integration-icons";

const integrations = [
  { name: "GitHub", slug: "github" as const },
  { name: "Notion", slug: "notion" as const },
  { name: "Airtable", slug: "airtable" as const },
  { name: "Gmail", slug: "gmail" as const },
  { name: "Google Docs", slug: "googledocs" as const },
  { name: "Google Sheets", slug: "googlesheets" as const },
  { name: "Linear", slug: "linear" as const },
  { name: "Slack", slug: "slack" as const },
  { name: "Discord", slug: "discord" as const },
  { name: "Sentry", slug: "sentry" as const },
  { name: "PostHog", slug: "posthog" as const },
  { name: "Datadog", slug: "datadog" as const },
  { name: "Vercel", slug: "vercel" as const },
];

export function IntegrationShowcase() {
  const [currentIntegrationIndex, setCurrentIntegrationIndex] = useState(0);
  const [hoveredIntegration, setHoveredIntegration] = useState<string | null>(
    null,
  );
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    // Only cycle through integrations when not hovering
    if (!isHovering && !hoveredIntegration) {
      const interval = setInterval(() => {
        setCurrentIntegrationIndex((prev) => (prev + 1) % integrations.length);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isHovering, hoveredIntegration]);

  // Duplicate integrations multiple times to ensure seamless scrolling
  const scrollIntegrations = [
    ...integrations,
    ...integrations,
    ...integrations,
  ];

  return (
    <div className="w-full space-y-6">
      {/* Text */}
      <div className="text-left">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">
          <span className="text-muted-foreground">
            Lightfast integrates with{" "}
          </span>
          <span className="text-foreground inline-block min-w-[120px]">
            {hoveredIntegration ??
              integrations[currentIntegrationIndex]?.name ??
              "GitHub"}
          </span>
        </h2>
      </div>

      {/* Integrations - Infinite Scroll */}
      <div
        className="relative w-full overflow-hidden py-3"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setHoveredIntegration(null);
        }}
      >
        <div
          className="flex animate-framework-scroll"
          style={{
            width: "max-content",
            animationPlayState: isHovering ? "paused" : "running",
          }}
        >
          {/* Triple the integrations for seamless loop */}
          {scrollIntegrations.map((integration, index) => {
            const originalIndex = index % integrations.length;
            const Icon = IntegrationIcons[integration.slug];
            return (
              <div
                key={index}
                className="flex-shrink-0 px-6 lg:px-8 py-1"
                onMouseEnter={() =>
                  setHoveredIntegration(
                    integrations[originalIndex]?.name ?? null,
                  )
                }
                onMouseLeave={() => setHoveredIntegration(null)}
              >
                <div
                  className={`p-2 rounded-sm transition-all duration-200 cursor-pointer ${
                    hoveredIntegration === integrations[originalIndex]?.name
                      ? "outline outline-2 outline-muted outline-offset-2"
                      : ""
                  }`}
                >
                  <Icon className="w-10 h-10 lg:w-12 lg:h-12 transition-all duration-200 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
        {/* Gradient overlays for fade effect on both sides */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
