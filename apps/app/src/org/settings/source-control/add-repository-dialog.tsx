import { importSourceControlRepository } from "@api/app/tanstack/source-control";
import {
  GitBranchIcon as GitBranch,
  Loading03Icon as Loader2,
  Search01Icon as Search,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/api-contract";
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
import { useMemo, useState } from "react";
import {
  type SourceControlRepositoryRow,
  sourceControlConnectionFromRepositories,
  sourceControlConnectionQueryKey,
  sourceControlRepositoriesQueryKey,
} from "./source-control-cache";

export function AddRepositoryDialog({
  disabled,
  repositories,
}: {
  disabled: boolean;
  repositories: SourceControlRepositoryRow[];
}) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<
    string | null
  >(null);

  const importRepository = useMutation({
    meta: { errorTitle: "Failed to add repository" },
    mutationFn: (data: { repositoryId: string }) =>
      importSourceControlRepository({ data }),
    onSuccess: (data) => {
      queryClient.setQueryData(sourceControlRepositoriesQueryKey, data);
      queryClient.setQueryData(
        sourceControlConnectionQueryKey,
        sourceControlConnectionFromRepositories(data)
      );
      setSelectedRepositoryId(null);
      setSearch("");
      setIsOpen(false);
    },
  });

  const selectableRepositories = useMemo(
    () =>
      repositories.filter(
        (repository) => repository.name !== LIGHTFAST_REPOSITORY_NAME
      ),
    [repositories]
  );
  const filteredRepositories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectableRepositories.filter((repository) => {
      if (!term) {
        return true;
      }
      return (
        repository.name.toLowerCase().includes(term) ||
        repository.fullName.toLowerCase().includes(term)
      );
    });
  }, [selectableRepositories, search]);

  const selectedRepository = filteredRepositories.find(
    (repository) => repository.id === selectedRepositoryId
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
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
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-6 rounded-lg border border-border/70 bg-muted/30 px-2.5 font-normal text-muted-foreground text-sm hover:bg-muted/60 hover:text-foreground"
          disabled={disabled}
          size="sm"
          type="button"
          variant="ghost"
        >
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
            <HugeiconsIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              icon={Search}
            />
            <Input
              aria-label="Search repositories"
              className="pl-9"
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search repositories"
              value={search}
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {filteredRepositories.length > 0 ? (
              filteredRepositories.map((repository) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-[8px] border border-border bg-background p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                      <HugeiconsIcon
                        aria-hidden="true"
                        className="size-3"
                        icon={GitBranch}
                      />
                      {repository.imported
                        ? "Already added"
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
              <p className="rounded-[8px] border border-border bg-muted/30 p-4 text-muted-foreground text-sm">
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
              importRepository.mutate({ repositoryId: selectedRepositoryId });
            }}
            type="button"
          >
            {importRepository.isPending ? (
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4 animate-spin"
                icon={Loader2}
              />
            ) : null}
            Add selected repository
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
