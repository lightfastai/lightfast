import { useAuth } from "@clerk/tanstack-react-start";
import {
  ReloadIcon as RefreshCw,
  Search01Icon as Search,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui-v2/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AddRepositoryDialog } from "./add-repository-dialog";
import { RepositoryCard } from "./repository-card";
import {
  type SourceControlRepositories,
  sourceControlQueryKeys,
} from "./source-control-queries";

type SyncFilter = "all" | "enabled" | "disabled";

export function RepositoryList({
  repositories,
}: {
  repositories: SourceControlRepositories;
}) {
  const { has, isLoaded } = useAuth();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");

  const importedRepositories = useMemo(
    () => repositories.repositories.filter((repository) => repository.imported),
    [repositories.repositories]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRepositories = useMemo(
    () =>
      importedRepositories.filter((repository) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          repository.fullName.toLowerCase().includes(normalizedQuery) ||
          repository.name.toLowerCase().includes(normalizedQuery);
        const matchesSync =
          syncFilter === "all" || repository.syncStatus === syncFilter;
        return matchesQuery && matchesSync;
      }),
    [importedRepositories, normalizedQuery, syncFilter]
  );

  const addDisabled =
    !isAdmin ||
    repositories.repositoriesError !== null ||
    repositories.status !== "bound";
  const hasImported = importedRepositories.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-base text-foreground">
          Repositories
        </h3>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh repositories"
            className="h-6 w-6 rounded-full"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: sourceControlQueryKeys.repositories(),
              })
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              className="size-3.5 opacity-50"
              icon={RefreshCw}
            />
          </Button>
          <AddRepositoryDialog
            disabled={addDisabled}
            repositories={repositories.repositories}
          />
        </div>
      </div>

      {repositories.repositoriesError ? (
        <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {repositories.repositoriesError.message}
        </div>
      ) : hasImported ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <HugeiconsIcon
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                icon={Search}
              />
              <Input
                aria-label="Search repositories"
                className="pl-8"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search repositories"
                size="lf"
                value={query}
                variant="lf"
              />
            </div>
            <Select
              onValueChange={(value) => {
                if (value !== null) {
                  setSyncFilter(value as SyncFilter);
                }
              }}
              value={syncFilter}
            >
              <SelectTrigger aria-label="Sync status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredRepositories.length > 0 ? (
            <div className="divide-y divide-border rounded-[12px] border border-border bg-background">
              {filteredRepositories.map((repository) => (
                <RepositoryCard key={repository.id} repository={repository} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No repositories match these filters.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-[12px] border border-border bg-background p-4 text-muted-foreground text-sm">
          No repositories added yet. Use{" "}
          <span className="font-medium text-foreground">Add repository</span> to
          connect one.
        </p>
      )}
    </section>
  );
}
