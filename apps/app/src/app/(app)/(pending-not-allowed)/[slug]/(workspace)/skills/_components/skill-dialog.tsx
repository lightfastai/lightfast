"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { SkillGlyph } from "./skill-glyph";
import { getSkillSourceUrl, SkillMarkdown } from "./skill-markdown";
import type { Skill } from "./skills-types";

export function SkillDialog({
  onOpenChange,
  repositoryUrl,
  skill,
}: {
  onOpenChange: (open: boolean) => void;
  repositoryUrl: string;
  skill?: Skill;
}) {
  const sourceUrl = skill ? getSkillSourceUrl({ repositoryUrl, skill }) : "";

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(skill)}>
      <DialogContent className="flex max-h-[82vh] flex-col gap-0 sm:max-w-2xl">
        {skill && (
          <>
            <DialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
              <SkillGlyph className="size-10 rounded-full" />
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <span className="truncate">{skill.name ?? skill.slug}</span>
                  <span className="font-normal text-base text-muted-foreground">
                    Skill
                  </span>
                </DialogTitle>
                {skill.description && (
                  <DialogDescription className="mt-2">
                    {skill.description}
                  </DialogDescription>
                )}
              </div>
            </DialogHeader>

            {skill.diagnostics.length > 0 && (
              <div className="mt-4 rounded-[9px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-500/90 text-xs">
                <span className="font-medium text-amber-500">
                  {skill.diagnostics.length}{" "}
                  {skill.diagnostics.length === 1 ? "diagnostic" : "diagnostics"}
                </span>
                <ul className="mt-1 space-y-1">
                  {skill.diagnostics.map((diagnostic) => (
                    <li key={`${diagnostic.code}:${diagnostic.message}`}>
                      {diagnostic.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[12px] border border-border bg-muted/20 p-4">
              <SkillMarkdown repositoryUrl={repositoryUrl} skill={skill} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-4">
              <span className="truncate font-mono text-muted-foreground text-xs">
                {skill.path}
              </span>
              {sourceUrl && (
                <Button asChild size="lf" variant="outline">
                  <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
                    <ExternalLink className="size-3.5" />
                    View source
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
