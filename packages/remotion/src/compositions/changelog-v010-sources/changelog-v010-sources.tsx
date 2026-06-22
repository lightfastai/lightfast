import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

const SOURCES = [
  { iconKey: "github" as const, name: "GitHub" },
  { iconKey: "vercel" as const, name: "Vercel" },
  { iconKey: "linear" as const, name: "Linear" },
  { iconKey: "sentry" as const, name: "Sentry" },
];

const CIRCLE_SIZE = 88;

export const ChangelogV010Sources: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return (
    <AbsoluteFill className="bg-card">
      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-border" />
      <div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
        style={{ height: CIRCLE_SIZE, gap: 72 }}
      >
        {SOURCES.map((source) => {
          const Icon = IntegrationLogoIcons[source.iconKey];
          return (
            <div
              className="flex items-center justify-center rounded-full border border-border bg-card"
              key={source.name}
              style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
            >
              <Icon className="size-9 text-foreground" />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
