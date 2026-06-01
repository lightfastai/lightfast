import { cn } from "@repo/ui/lib/utils";

type ConnectorProvider = "linear" | "slack" | "notion" | "sentry";

interface ConnectorIconProps {
  className?: string;
  provider: ConnectorProvider;
}

const iconStyles: Record<ConnectorProvider, string> = {
  linear: "border-violet-500/20 bg-violet-500/10 text-violet-500",
  notion: "border-foreground/15 bg-background text-foreground",
  sentry: "border-amber-500/25 bg-amber-500/10 text-amber-600",
  slack: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
};

const labels: Record<ConnectorProvider, string> = {
  linear: "Li",
  notion: "No",
  sentry: "Se",
  slack: "Sl",
};

export function ConnectorIcon({ className, provider }: ConnectorIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border font-mono font-medium text-[11px]",
        iconStyles[provider],
        className
      )}
    >
      {labels[provider]}
    </span>
  );
}

export function LinearIcon({ className }: { className?: string }) {
  return <ConnectorIcon className={className} provider="linear" />;
}

export function SlackIcon({ className }: { className?: string }) {
  return <ConnectorIcon className={className} provider="slack" />;
}

export function NotionIcon({ className }: { className?: string }) {
  return <ConnectorIcon className={className} provider="notion" />;
}

export function SentryIcon({ className }: { className?: string }) {
  return <ConnectorIcon className={className} provider="sentry" />;
}
