import {
  DatabaseIcon as Database,
  Key01Icon as KeyRound,
  CellularNetworkIcon as RadioTower,
  SecurityCheckIcon as ShieldCheck,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { DeveloperConnectionProvider } from "./developer-connections-model";

export function DeveloperConnectionIcon({
  provider,
}: {
  provider: DeveloperConnectionProvider;
}) {
  const icon =
    provider === "pscale"
      ? Database
      : provider === "upstash"
        ? RadioTower
        : provider === "sentry"
          ? ShieldCheck
          : KeyRound;

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-muted/35">
      <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" />
    </div>
  );
}
