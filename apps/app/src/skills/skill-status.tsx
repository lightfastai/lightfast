import { Badge } from "@repo/ui/components/ui/badge";
import type { SkillsFreshness } from "./skills-types";

export function SkillStatus({ freshness }: { freshness: SkillsFreshness }) {
  const status = freshness.status;
  const variant = status === "fresh" ? "secondary" : "outline";

  return (
    <div className="flex flex-wrap items-center gap-2">
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

function getStatusLabel(status: SkillsFreshness["status"]) {
  return STATUS_LABELS[status];
}

const STATUS_LABELS: Record<SkillsFreshness["status"], string> = {
  fresh: "Latest",
  refreshing: "Refreshing",
  stale: "Stale",
  unavailable: "Unavailable",
};
