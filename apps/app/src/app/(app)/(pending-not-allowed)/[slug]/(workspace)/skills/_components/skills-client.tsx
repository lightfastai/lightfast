"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { useDeferredValue, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { SkillDialog } from "./skill-dialog";
import { SkillGrid } from "./skill-grid";
import { SkillStatus } from "./skill-status";
import type { Skill } from "./skills-types";

type SkillFilter = "all" | "invalid" | "valid";

export function SkillsClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const [skillParam, setSkillParam] = useQueryState("skill");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const visibleSkills = useMemo(
    () =>
      data.skills
        .filter((skill) => matchesFilter(skill, filter))
        .filter((skill) => matchesQuery(skill, deferredQuery))
        .sort((a, b) => {
          if (a.validationStatus !== b.validationStatus) {
            return a.validationStatus === "invalid" ? -1 : 1;
          }
          return a.slug.localeCompare(b.slug);
        }),
    [data.skills, deferredQuery, filter]
  );

  const selectedSkill = skillParam
    ? data.skills.find((skill) => skill.slug === skillParam)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="pt-6 text-center">
        <h1 className="font-semibold text-3xl text-foreground tracking-[-0.02em]">
          Make Lightfast work your way
        </h1>
        <p className="mx-auto mt-3 max-w-[30rem] text-muted-foreground text-sm">
          Reusable instructions your agents load on demand, indexed from your
          team&apos;s connected GitHub repository.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search skills"
            className="pl-8"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search skills"
            size="lf"
            value={query}
            variant="lf"
          />
        </div>
        <Select
          onValueChange={(value) => setFilter(value as SkillFilter)}
          value={filter}
        >
          <SelectTrigger
            aria-label="Filter skills"
            className="h-7 shrink-0 rounded-[9px] sm:w-32"
            size="sm"
          >
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <SkillStatus freshness={data.freshness} />
        {data.repositoryUrl && (
          <Button asChild size="lf" variant="ghost">
            <a
              href={data.repositoryUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open repository
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      {data.indexDiagnostics.length > 0 && (
        <div className="mt-4 rounded-[9px] border border-border bg-muted/20 px-3 py-2">
          <p className="font-medium text-foreground text-sm">
            Index diagnostics
          </p>
          <ul className="mt-1 space-y-1">
            {data.indexDiagnostics.map((diagnostic) => (
              <li
                className="text-muted-foreground text-xs"
                key={`${diagnostic.code}:${diagnostic.message}`}
              >
                {diagnostic.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SkillGrid
        emptyState={
          data.skills.length === 0
            ? "No skills indexed."
            : "No matching skills."
        }
        onSelect={(slug) => {
          void setSkillParam(slug);
        }}
        skills={visibleSkills}
      />

      <SkillDialog
        onOpenChange={(open) => {
          if (!open) {
            void setSkillParam(null);
          }
        }}
        repositoryUrl={data.repositoryUrl}
        skill={selectedSkill}
      />
    </div>
  );
}

function matchesFilter(skill: Skill, filter: SkillFilter): boolean {
  return filter === "all" || skill.validationStatus === filter;
}

function matchesQuery(skill: Skill, query: string): boolean {
  if (!query) {
    return true;
  }

  return [skill.slug, skill.name ?? "", skill.description ?? "", skill.path]
    .join(" ")
    .toLowerCase()
    .includes(query);
}
