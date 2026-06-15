import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { LfSelect } from "~/components/lf-select";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { SkillDialog } from "./skill-dialog";
import { SkillGrid } from "./skill-grid";
import { SkillsActions } from "./skills-actions";
import { SkillsLoading } from "./skills-loading";
import { getVisibleSkills, type SkillFilter } from "./skills-model";
import type { NormalizedSkillsSearch } from "./skills-search-params";
import type { SkillsListResult } from "./skills-types";
import { useSkillIndexRefreshController } from "./use-skill-index-refresh-controller";
import { useSkillsListQuery } from "./use-skills-list-query";

export function SkillsClient({
  search,
  setSearchParams,
}: {
  search: NormalizedSkillsSearch;
  setSearchParams: (updates: Partial<NormalizedSkillsSearch>) => void;
}) {
  const { query: skillsQuery } = useSkillsListQuery();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SkillFilter>("all");
  const data = skillsQuery.data;

  if (skillsQuery.isError) {
    return (
      <WorkspaceSurface
        className="overflow-y-auto bg-background"
        variant="flush"
      >
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <section className="space-y-4">
            <h1 className="font-semibold text-2xl text-foreground">
              Skills unavailable
            </h1>
            <p className="max-w-md text-muted-foreground text-sm leading-6">
              The skills index could not be loaded for this workspace.
            </p>
            <Button
              onClick={() => void skillsQuery.refetch()}
              size="lf"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </section>
        </div>
      </WorkspaceSurface>
    );
  }

  if (!data) {
    return <SkillsLoading />;
  }

  return (
    <SkillsClientContent
      data={data}
      filter={filter}
      query={query}
      search={search}
      setFilter={setFilter}
      setQuery={setQuery}
      setSearchParams={setSearchParams}
    />
  );
}

function SkillsClientContent({
  data,
  filter,
  query,
  search,
  setFilter,
  setQuery,
  setSearchParams,
}: {
  data: SkillsListResult;
  filter: SkillFilter;
  query: string;
  search: NormalizedSkillsSearch;
  setFilter: (filter: SkillFilter) => void;
  setQuery: (query: string) => void;
  setSearchParams: (updates: Partial<NormalizedSkillsSearch>) => void;
}) {
  useSkillIndexRefreshController(data);
  const deferredQuery = useDeferredValue(query);
  const visibleSkills = useMemo(
    () =>
      getVisibleSkills(data.skills, {
        query: deferredQuery,
        validationStatus: filter,
      }),
    [data, deferredQuery, filter]
  );
  const selectedSkill = search.skill
    ? data.skills.find((skill) => skill.slug === search.skill)
    : undefined;

  return (
    <WorkspaceSurface className="overflow-y-auto bg-background" variant="flush">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="pt-6 text-center">
          <h1 className="font-semibold text-3xl text-foreground tracking-[-0.02em]">
            Make Lightfast work your way
          </h1>
          <p className="mx-auto mt-3 max-w-[30rem] text-muted-foreground text-sm">
            Reusable instructions your agents load on demand, indexed from your
            team&apos;s connected GitHub repository.
          </p>
          <div className="mt-4">
            <SkillsActions
              freshness={data.freshness}
              repositoryUrl={data.repositoryUrl}
            />
          </div>
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
          <LfSelect
            align="end"
            aria-label="Filter skills"
            className="shrink-0 sm:w-32"
            onValueChange={(value) => setFilter(toSkillFilter(value))}
            options={[
              { label: "All", value: "all" },
              { label: "Valid", value: "valid" },
              { label: "Invalid", value: "invalid" },
            ]}
            value={filter}
          />
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
          onSelect={(slug) => setSearchParams({ skill: slug })}
          skills={visibleSkills}
        />

        <SkillDialog
          onOpenChange={(open) => {
            if (!open) {
              setSearchParams({ skill: null });
            }
          }}
          repositoryUrl={data.repositoryUrl}
          skill={selectedSkill}
        />
      </div>
    </WorkspaceSurface>
  );
}

function toSkillFilter(value: string): SkillFilter {
  return value === "valid" || value === "invalid" ? value : "all";
}
