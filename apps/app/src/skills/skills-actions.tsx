import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { SkillStatus } from "./skill-status";
import type { SkillsFreshness } from "./skills-types";

export function SkillsActions({
  freshness,
  repositoryUrl,
}: {
  freshness: SkillsFreshness;
  repositoryUrl: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
      <SkillStatus freshness={freshness} />
      {repositoryUrl && (
        <Button
          asChild
          className="h-6 rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
          size="sm"
          variant="ghost"
        >
          <a href={repositoryUrl} rel="noopener noreferrer" target="_blank">
            <Icons.github aria-hidden="true" className="size-3.5" />
            View Source
          </a>
        </Button>
      )}
    </div>
  );
}
