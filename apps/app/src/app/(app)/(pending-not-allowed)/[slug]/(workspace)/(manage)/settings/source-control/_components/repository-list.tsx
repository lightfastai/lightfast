"use client";

import type { AppRouterOutputs } from "@api/app";
import { Button } from "@repo/ui/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import { AddRepositoryDialog } from "./add-repository-dialog";
import { RepositoryCard } from "./repository-card";

type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

export function RepositoryList({
  repositories,
}: {
  repositories: SourceControlRepositories;
}) {
  const { has, isLoaded } = useAuth();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions =
    trpc.org.settings.sourceControl.listRepositories.queryOptions();

  const importedRepositories = useMemo(
    () => repositories.repositories.filter((repository) => repository.imported),
    [repositories.repositories]
  );

  const addDisabled =
    !isAdmin ||
    repositories.repositoriesError !== null ||
    repositories.status !== "bound";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-normal text-[11px] text-muted-foreground">
          Repositories
        </h3>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh repositories"
            className="h-6 w-6 rounded-full"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: listQueryOptions.queryKey,
              })
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" className="size-3.5 opacity-50" />
          </Button>
          <AddRepositoryDialog
            disabled={addDisabled}
            repositories={repositories.repositories}
          />
        </div>
      </div>

      {repositories.repositoriesError ? (
        <div className="rounded-[8px] border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
          {repositories.repositoriesError.message}
        </div>
      ) : importedRepositories.length > 0 ? (
        <div className="space-y-3">
          {importedRepositories.map((repository) => (
            <RepositoryCard key={repository.id} repository={repository} />
          ))}
        </div>
      ) : (
        <p className="rounded-[8px] border border-border bg-background p-4 text-muted-foreground text-sm">
          No repositories added yet. Use{" "}
          <span className="font-medium text-foreground">Add repository</span> to
          connect one.
        </p>
      )}
    </section>
  );
}
