"use client";

import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import {
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";

type SourceControlConnection =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"];
type SourceControlRepositories =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["listRepositories"];

interface SourceControlConnectionSectionProps {
  connection: SourceControlConnection;
  orgSlug: string;
  repositories: SourceControlRepositories;
}

function importedCountLabel(count: number) {
  return `${count} imported`;
}

function formatLightfastVerifiedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SourceControlConnectionSection({
  connection,
  orgSlug,
  repositories,
}: SourceControlConnectionSectionProps) {
  const { has, isLoaded } = useAuth();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions =
    trpc.org.settings.sourceControl.listRepositories.queryOptions();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<
    string | null
  >(null);

  const importRepository = useMutation(
    trpc.org.settings.sourceControl.importRepository.mutationOptions({
      meta: { errorTitle: "Failed to add repository" },
      onSuccess: (data) => {
        queryClient.setQueryData(listQueryOptions.queryKey, data);
        setSelectedRepositoryId(null);
        setSearch("");
        setIsAddOpen(false);
      },
    })
  );

  const visibleRepositories = useMemo(
    () =>
      repositories.repositories.filter(
        (repository) => repository.name !== ".lightfast"
      ),
    [repositories.repositories]
  );
  const filteredRepositories = useMemo(() => {
    const term = search.trim().toLowerCase();

    return visibleRepositories.filter((repository) => {
      if (!term) {
        return true;
      }

      return (
        repository.name.toLowerCase().includes(term) ||
        repository.fullName.toLowerCase().includes(term)
      );
    });
  }, [visibleRepositories, search]);

  const isLiveConnectionHealthy =
    repositories.status === "bound" && repositories.organization !== null;
  const importedRepositoryCount =
    repositories.binding?.importedRepositoryCount ??
    connection?.importedRepositoryCount ??
    0;
  const addDisabled =
    !isAdmin ||
    repositories.repositoriesError !== null ||
    repositories.status !== "bound";
  const selectedRepository = filteredRepositories.find(
    (repository) => repository.id === selectedRepositoryId
  );

  const handleAddDialogOpenChange = (open: boolean) => {
    setIsAddOpen(open);

    if (!open) {
      setSearch("");
      setSelectedRepositoryId(null);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSelectedRepositoryId(null);
  };

  if (connection === null) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground text-xl">GitHub</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Connect repositories for this team.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                No GitHub organization connected
              </p>
              <p className="text-muted-foreground text-sm">
                Connect GitHub from setup before workspace features can use
                source-control data.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/${orgSlug}/tasks/bind` as Route}>
                <ExternalLink aria-hidden="true" className="size-4" />
                Open setup
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const organizationLogin = repositories.organization?.login;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-foreground text-xl">GitHub</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage repositories connected to this team.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <Icons.github
                aria-hidden="true"
                className="size-4 text-foreground"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground text-sm">
                {organizationLogin ?? "GitHub access needs attention"}
              </p>
              <p className="text-muted-foreground text-xs">
                {importedCountLabel(importedRepositoryCount)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isLiveConnectionHealthy ? (
              <Badge
                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                variant="outline"
              >
                Connected
              </Badge>
            ) : (
              <Badge
                className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                variant="outline"
              >
                Needs attention
              </Badge>
            )}
            {isAdmin && repositories.organization?.installationManageUrl ? (
              <Button asChild size="sm" variant="ghost">
                <a
                  href={repositories.organization.installationManageUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Manage GitHub access
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {repositories.lightfastRepository ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-medium text-foreground text-sm">
              Lightfast repository
            </h3>
            <p className="text-muted-foreground text-sm">
              The repository Lightfast uses to verify and coordinate workspace
              automation.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                  <Icons.logoShort
                    aria-hidden="true"
                    className="size-5 text-foreground"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground text-sm">
                    {repositories.lightfastRepository.fullName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    .lightfast repository
                  </p>
                </div>
              </div>
              <Badge
                className="w-fit border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                variant="outline"
              >
                Verified
              </Badge>
            </div>
            <div className="mt-4 border-border border-t pt-4">
              <p className="text-muted-foreground text-xs">Verified at</p>
              <p className="mt-1 text-foreground text-sm">
                {formatLightfastVerifiedAt(
                  repositories.lightfastRepository.verifiedAt
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium text-foreground text-sm">
              Repositories
            </h3>
            <p className="text-muted-foreground text-sm">
              Add repositories one at a time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-label="Refresh repositories"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: listQueryOptions.queryKey,
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
            </Button>
            <Dialog onOpenChange={handleAddDialogOpenChange} open={isAddOpen}>
              <DialogTrigger asChild>
                <Button disabled={addDisabled} size="sm" type="button">
                  <Plus aria-hidden="true" className="size-4" />
                  Add repository
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add repository</DialogTitle>
                  <DialogDescription>
                    Select one GitHub repository to add to this workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      aria-label="Search repositories"
                      className="pl-9"
                      onChange={(event) =>
                        handleSearchChange(event.target.value)
                      }
                      placeholder="Search repositories"
                      value={search}
                    />
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {filteredRepositories.length > 0 ? (
                      filteredRepositories.map((repository) => (
                        <button
                          className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={repository.imported}
                          key={repository.id}
                          onClick={() => setSelectedRepositoryId(repository.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground text-sm">
                              {repository.fullName}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
                              <GitBranch
                                aria-hidden="true"
                                className="size-3"
                              />
                              {repository.imported
                                ? "Already imported"
                                : selectedRepositoryId === repository.id
                                  ? "Selected"
                                  : "Available"}
                            </span>
                          </span>
                          <Badge variant="outline">
                            {repository.private ? "Private" : "Public"}
                          </Badge>
                        </button>
                      ))
                    ) : (
                      <p className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground text-sm">
                        No repositories match your search.
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={
                      !selectedRepository ||
                      selectedRepository.imported ||
                      importRepository.isPending
                    }
                    onClick={() => {
                      if (!selectedRepositoryId) {
                        return;
                      }

                      importRepository.mutate({
                        repositoryId: selectedRepositoryId,
                      });
                    }}
                    type="button"
                  >
                    {importRepository.isPending ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : null}
                    Add selected repository
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {repositories.repositoriesError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
            {repositories.repositoriesError.message}
          </div>
        ) : null}

        <div className="divide-y divide-border rounded-lg border border-border">
          {visibleRepositories.length > 0 ? (
            visibleRepositories.map((repository) => (
              <div
                className="flex items-center justify-between gap-3 p-3"
                key={repository.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground text-sm">
                    {repository.fullName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {repository.imported ? "Imported" : "Not imported"}
                  </p>
                </div>
                <Badge variant="outline">
                  {repository.private ? "Private" : "Public"}
                </Badge>
              </div>
            ))
          ) : (
            <p className="p-3 text-muted-foreground text-sm">
              No repositories available.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
