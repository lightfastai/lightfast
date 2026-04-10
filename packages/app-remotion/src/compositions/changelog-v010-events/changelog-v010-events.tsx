import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { AbsoluteFill, continueRender, delayRender } from "@vendor/remotion";
import type React from "react";
import { useEffect, useState } from "react";
import { ensureFontsLoaded } from "../landing-hero/shared/fonts";

const CANVAS_W = 1200;
const CANVAS_H = 675;

interface FeedEvent {
  detail: string;
  extra?: string[];
  label: string;
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
}

const EVENTS: FeedEvent[] = [
  {
    source: "GitHub",
    label: "PR Opened",
    detail: "#842 search index batching",
  },
  {
    source: "Sentry",
    label: "Issue Created",
    detail: "LF-1128 TypeError in worker",
    extra: [
      "TypeError: Cannot read property 'index' of undefined",
      "at SearchWorker.process (worker.ts:142)",
    ],
  },
  {
    source: "Linear",
    label: "Issue Updated",
    detail: "MEM-302 ranking threshold",
  },
  {
    source: "Vercel",
    label: "Deployment Ready",
    detail: "lightfast-app — Production",
  },
];

const SOURCE_COLORS: Record<FeedEvent["source"], string> = {
  Vercel: "#e5e5e5",
  GitHub: "#c7c7c7",
  Sentry: "#9b9b9b",
  Linear: "#c7c7c7",
};

const SOURCE_ICON_KEY: Record<
  FeedEvent["source"],
  keyof typeof IntegrationLogoIcons
> = {
  Vercel: "vercel",
  GitHub: "github",
  Sentry: "sentry",
  Linear: "linear",
};

const CARD_WIDTH = 480;
const CARD_GAP = 8;
const COMPACT_ROW_HEIGHT = 74;
const EXPANDED_ROW_HEIGHT = COMPACT_ROW_HEIGHT * 2;

export const ChangelogV010Events: React.FC = () => {
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
      <div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col"
        style={{ width: CARD_WIDTH, gap: CARD_GAP }}
      >
        {EVENTS.map((event, i) => {
          const height = event.extra ? EXPANDED_ROW_HEIGHT : COMPACT_ROW_HEIGHT;
          const Icon = IntegrationLogoIcons[SOURCE_ICON_KEY[event.source]];

          return (
            <div
              className="flex flex-col gap-2 rounded-md border border-border px-3 py-3 font-sans"
              key={i}
              style={{ height }}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: SOURCE_COLORS[event.source] }}
                />
                <span className="font-medium font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  {event.source}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                <span className="shrink-0 text-foreground">{event.label}</span>
                <span className="shrink-0 text-muted-foreground/40">•</span>
                <span className="truncate text-muted-foreground">
                  {event.detail}
                </span>
              </div>
              {event.extra && (
                <div className="mt-1 flex flex-col gap-1 border-border/50 border-t pt-2">
                  {event.extra.map((line, lineIndex) => (
                    <span
                      className="truncate font-mono text-muted-foreground/50 text-xs leading-tight"
                      key={`${lineIndex}-${line}`}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
