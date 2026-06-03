import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";

type Freshness =
  AppRouterOutputs["org"]["workspace"]["skills"]["list"]["freshness"];

export function SkillStatus({ freshness }: { freshness: Freshness }) {
  const status = freshness.status;
  const variant = status === "fresh" ? "secondary" : "outline";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <Badge variant={variant}>{getStatusLabel(status)}</Badge>
      {freshness.indexedCommitSha && (
        <span className="font-mono text-muted-foreground text-xs">
          {freshness.indexedCommitSha.slice(0, 7)}
        </span>
      )}
      {freshness.errorMessage && (
        <span className="text-muted-foreground text-xs">
          {freshness.errorMessage}
        </span>
      )}
    </div>
  );
}

function getStatusLabel(status: Freshness["status"]) {
  return STATUS_LABELS[status];
}

const STATUS_LABELS: Record<Freshness["status"], string> = {
  fresh: "Latest",
  refreshing: "Refreshing",
  stale: "Stale",
  unavailable: "Unavailable",
};
