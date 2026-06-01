"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { SkillRow } from "./skill-row";
import { SkillStatus } from "./skill-status";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
type Skill = SkillsListResult["skills"][number];
type SkillFilter = "all" | "invalid" | "valid";

export function SkillsClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const skills = useMemo(() => {
    return data.skills
      .filter((skill) => matchesFilter(skill, filter))
      .filter((skill) => matchesQuery(skill, deferredQuery))
      .sort((a, b) => {
        if (a.validationStatus !== b.validationStatus) {
          return a.validationStatus === "invalid" ? -1 : 1;
        }
        return a.slug.localeCompare(b.slug);
      });
  }, [data.skills, deferredQuery, filter]);

  return (
    <WorkspaceSurface
      className="flex min-h-full flex-col bg-background"
      variant="flush"
    >
      <div className="border-border/70 border-b px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-semibold text-foreground text-lg">Skills</h1>
            <SkillStatus freshness={data.freshness} />
          </div>
          {data.repositoryUrl && (
            <Button asChild size="sm" variant="outline">
              <a
                href={data.repositoryUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-3.5" />
                Open in GitHub
              </a>
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            className="max-w-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills"
            value={query}
          />
          <Tabs
            onValueChange={(value) => setFilter(value as SkillFilter)}
            value={filter}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="invalid">Invalid</TabsTrigger>
              <TabsTrigger value="valid">Valid</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {data.indexDiagnostics.length > 0 && (
        <div className="border-border/70 border-b bg-muted/20 px-6 py-3">
          <p className="font-medium text-foreground text-sm">
            Index diagnostics
          </p>
          <ul className="mt-2 space-y-1">
            {data.indexDiagnostics.map((diagnostic) => (
              <li
                className="text-muted-foreground text-sm"
                key={`${diagnostic.code}:${diagnostic.message}`}
              >
                {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col">
        {skills.length === 0 ? (
          <div className="px-6 py-12 text-muted-foreground text-sm">
            No skills indexed.
          </div>
        ) : (
          skills.map((skill) => (
            <SkillRow
              key={skill.slug}
              repositoryUrl={data.repositoryUrl}
              skill={skill}
            />
          ))
        )}
      </div>
    </WorkspaceSurface>
  );
}

function matchesFilter(skill: Skill, filter: SkillFilter): boolean {
  return filter === "all" || skill.validationStatus === filter;
}

function matchesQuery(skill: Skill, query: string): boolean {
  if (!query) {
    return true;
  }

  return [
    skill.slug,
    skill.name ?? "",
    skill.description ?? "",
    skill.path,
    ...skill.diagnostics.map((diagnostic) => diagnostic.message),
    ...skill.resources.assets,
    ...skill.resources.references,
    ...skill.resources.scripts,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
