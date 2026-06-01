"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { SkillMarkdown, getSkillSourceUrl } from "./skill-markdown";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
type Skill = SkillsListResult["skills"][number];

export function SkillRow({
  repositoryUrl,
  skill,
}: {
  repositoryUrl: string;
  skill: Skill;
}) {
  const params = useParams<{ slug: string }>();
  const [open, setOpen] = useState(false);
  const sourceUrl = getSkillSourceUrl({ repositoryUrl, skill });
  const resourceCount =
    skill.resources.assets.length +
    skill.resources.references.length +
    skill.resources.scripts.length;

  return (
    <Collapsible
      className="border-border/70 border-b px-6 py-4"
      onOpenChange={setOpen}
      open={open}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="truncate font-medium text-foreground text-sm hover:underline"
              href={`/${params.slug}/skills/${skill.slug}` as Route}
            >
              {skill.name ?? skill.slug}
            </Link>
            <Badge
              variant={
                skill.validationStatus === "valid" ? "secondary" : "outline"
              }
            >
              {skill.validationStatus}
            </Badge>
            {skill.diagnostics.length > 0 && (
              <Badge variant="outline">
                {skill.diagnostics.length} diagnostics
              </Badge>
            )}
          </div>
          {skill.description && (
            <p className="mt-1 text-muted-foreground text-sm">
              {skill.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
            <span>{skill.path}</span>
            <span>{resourceCount} resources</span>
            {skill.nonStandardResourceCount > 0 && (
              <span>{skill.nonStandardResourceCount} non-standard</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sourceUrl && (
            <Button asChild size="sm" variant="ghost">
              <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
                <ExternalLink className="size-3.5" />
                Source
              </a>
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              <ChevronDown
                className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              />
              Preview
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-4">
          <SkillMarkdown repositoryUrl={repositoryUrl} skill={skill} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
