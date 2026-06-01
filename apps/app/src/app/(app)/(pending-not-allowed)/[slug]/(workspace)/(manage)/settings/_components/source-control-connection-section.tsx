"use client";

import type { AppRouterOutputs } from "@api/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
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

interface LightfastRepositorySectionProps {
  connection: SourceControlConnection;
  orgSlug: string;
}

const connectionDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function importedCountLabel(count: number) {
  return `${count} imported`;
}

function isValidDate(value: Date) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function FormattedConnectionDate({ value }: { value: Date }) {
  if (!isValidDate(value)) {
    return "Not available";
  }

  return (
    <time dateTime={value.toISOString()}>
      {connectionDateFormatter.format(value)}
    </time>
  );
}

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "Not available";
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
        (repository) => repository.name !== LIGHTFAST_REPOSITORY_NAME
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-foreground text-xl">
          GitHub connection
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage source-control repositories connected to this team.
        </p>
      </div>

      {connection ? (
        <>
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
                    {displayValue(
                      repositories.organization?.login ??
                        connection.accountLogin
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {connection.providerLabel} organization
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

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Connected at</dt>
                <dd className="mt-1 text-foreground text-sm">
                  <FormattedConnectionDate value={connection.connectedAt} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Repositories</dt>
                <dd className="mt-1 text-foreground text-sm">
                  {importedCountLabel(importedRepositoryCount)}
                </dd>
              </div>
            </dl>
          </div>

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
                <Dialog
                  onOpenChange={handleAddDialogOpenChange}
                  open={isAddOpen}
                >
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
                              onClick={() =>
                                setSelectedRepositoryId(repository.id)
                              }
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
        </>
      ) : (
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
      )}
    </section>
  );
}

export function LightfastRepositorySection({
  connection,
  orgSlug,
}: LightfastRepositorySectionProps) {
  const repository = connection?.lightfastRepository ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-foreground text-xl">
          Lightfast repository
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          The repository Lightfast uses to verify and coordinate workspace
          automation.
        </p>
      </div>

      {repository ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icons.logoShort
                  aria-hidden="true"
                  className="size-4 text-foreground"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground text-sm">
                  {repository.fullName}
                </p>
                <p className="text-muted-foreground text-xs">
                  {LIGHTFAST_REPOSITORY_NAME} repository
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
              Verified
            </span>
          </div>

          <dl className="mt-5 grid gap-4">
            <div>
              <dt className="text-muted-foreground text-xs">Verified at</dt>
              <dd className="mt-1 text-foreground text-sm">
                <FormattedConnectionDate value={repository.verifiedAt} />
              </dd>
            </div>
          </dl>
        </div>
      ) : connection ? (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                .lightfast is not verified
              </p>
              <p className="text-muted-foreground text-sm">
                Create and verify {connection.accountLogin}/
                {LIGHTFAST_REPOSITORY_NAME} before workspace features unlock.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/${orgSlug}/tasks/github/lightfast-repo` as Route}>
                <ExternalLink aria-hidden="true" className="size-4" />
                Open setup
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                Connect GitHub first
              </p>
              <p className="text-muted-foreground text-sm">
                Connect a GitHub organization before verifying the{" "}
                {LIGHTFAST_REPOSITORY_NAME} repository.
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
      )}
    </section>
  );
}
