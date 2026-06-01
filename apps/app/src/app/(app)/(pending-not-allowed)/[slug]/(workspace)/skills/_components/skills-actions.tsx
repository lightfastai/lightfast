"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import { SkillStatus } from "./skill-status";
import { useSkillsList } from "./use-skills-list";

export function SkillsActions() {
  const { freshness, repositoryUrl } = useSkillsList();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <SkillStatus freshness={freshness} />
      {repositoryUrl && (
        <Button asChild size="lf" variant="ghost">
          <a href={repositoryUrl} rel="noopener noreferrer" target="_blank">
            Open repository
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
