"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { BookOpen, Check, Loader2, Unplug } from "lucide-react";

export function RepoIndexConfig() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const statusQueryKey = trpc.repoIndex.status.queryOptions().queryKey;

  const { data: status } = useSuspenseQuery({
    ...trpc.repoIndex.status.queryOptions(),
    staleTime: 30_000,
  });

  const invalidateStatus = () =>
    queryClient.invalidateQueries({ queryKey: statusQueryKey });

  const activateMutation = useMutation(
    trpc.repoIndex.activate.mutationOptions({
      meta: { errorTitle: "Failed to activate repo indexing" },
      onSuccess: () => {
        toast.success("Repo indexing activated");
      },
      onSettled: () => void invalidateStatus(),
    })
  );

  const deactivateMutation = useMutation(
    trpc.repoIndex.deactivate.mutationOptions({
      meta: { errorTitle: "Failed to deactivate repo indexing" },
      onSuccess: () => {
        toast.success("Repo indexing deactivated");
      },
      onSettled: () => void invalidateStatus(),
    })
  );

  if (status.status === "not_connected") {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-6">
        <div className="flex items-start gap-3">
          <Unplug className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium text-sm">
              No .lightfast repository connected
            </h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Create a{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                .lightfast
              </code>{" "}
              repository in your GitHub organization, then connect it from the
              Sources page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status.status === "inactive") {
    return (
      <div className="rounded-lg border border-border/60 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">{status.repoFullName}</h3>
              <p className="mt-1 text-muted-foreground text-sm">
                Repository detected. Activate to start indexing content for AI
                agent context.
              </p>
            </div>
          </div>
          <Button
            disabled={activateMutation.isPending}
            onClick={() =>
              activateMutation.mutate({
                integrationId: status.integrationId!,
                installationId: status.installationId!,
                repoFullName: status.repoFullName!,
                providerResourceId: status.providerResourceId!,
              })
            }
            size="sm"
          >
            {activateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Activate
          </Button>
        </div>
      </div>
    );
  }

  // status === "active"
  return (
    <div className="rounded-lg border border-border/60 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Check className="mt-0.5 h-5 w-5 text-green-500" />
          <div>
            <h3 className="font-medium text-sm">{status.repoFullName}</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              Repo indexing is active.
              {status.lastSyncedAt && (
                <>
                  {" "}
                  Last synced {new Date(status.lastSyncedAt).toLocaleString()}.
                </>
              )}
              {!status.hasContent && (
                <> No README.md found — content will sync on next push.</>
              )}
            </p>
          </div>
        </div>
        <Button
          disabled={deactivateMutation.isPending}
          onClick={() => deactivateMutation.mutate()}
          size="sm"
          variant="outline"
        >
          {deactivateMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Deactivate
        </Button>
      </div>
    </div>
  );
}
