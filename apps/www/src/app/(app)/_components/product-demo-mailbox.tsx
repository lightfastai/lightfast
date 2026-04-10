import { IntegrationLogoIcons } from "@repo/ui/integration-icons";
import { Search } from "lucide-react";

interface FeedEvent {
  detail: string;
  extra?: string[];
  label: string;
  source: "Vercel" | "GitHub" | "Sentry" | "Linear";
}

const FEED_EVENTS: FeedEvent[] = [
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
  { source: "Vercel", label: "Deployment Ready", detail: "api@prod-us-east-1" },
  { source: "GitHub", label: "PR Merged", detail: "#839 edge cache warmup" },
  {
    source: "Sentry",
    label: "Metric Alert",
    detail: "p95 latency crossed 240ms",
    extra: [
      "Current: 312ms · Threshold: 240ms",
      "Region: us-east-1 · Window: 5m",
    ],
  },
];

const SOURCE_ICON_KEY: Record<
  FeedEvent["source"],
  keyof typeof IntegrationLogoIcons
> = {
  Vercel: "vercel",
  GitHub: "github",
  Sentry: "sentry",
  Linear: "linear",
};

export function ProductDemoMailbox() {
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-border/40 border-r md:w-[300px] lg:w-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between border-border/40 border-b px-3 py-2">
        <span className="font-medium text-sm">Events</span>
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 border-border/40 border-b px-3 py-2">
        <Search className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground text-sm">Search...</span>
      </div>

      {/* Event rows */}
      <div className="flex-1 overflow-y-auto">
        {FEED_EVENTS.map((event, idx) => {
          const Icon = IntegrationLogoIcons[SOURCE_ICON_KEY[event.source]];
          return (
            <div
              className="flex cursor-pointer flex-col gap-2 border-border/40 border-b px-3 py-3 transition-colors hover:bg-muted/50"
              key={`${event.source}-${idx}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-medium font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  {event.source}
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-hidden text-sm">
                <span className="shrink-0 text-foreground">{event.label}</span>
                <span className="shrink-0 text-muted-foreground/40">·</span>
                <span className="truncate text-muted-foreground">
                  {event.detail}
                </span>
              </div>
              {event.extra && (
                <div className="flex flex-col gap-1 border-border/50 border-t pt-2">
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
    </div>
  );
}
