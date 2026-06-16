import { Database, KeyRound, RadioTower, ShieldCheck } from "lucide-react";
import type { DeveloperConnectionProvider } from "./developer-connections-model";

export function DeveloperConnectionIcon({
  provider,
}: {
  provider: DeveloperConnectionProvider;
}) {
  const Icon =
    provider === "pscale"
      ? Database
      : provider === "upstash"
        ? RadioTower
        : provider === "sentry"
          ? ShieldCheck
          : KeyRound;

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-muted/35">
      <Icon className="size-4 text-muted-foreground" />
    </div>
  );
}
