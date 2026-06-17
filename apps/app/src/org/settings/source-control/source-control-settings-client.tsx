import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { RepositoryList } from "./repository-list";
import { SourceControlConnectionCard } from "./source-control-connection-card";
import {
  sourceControlConnectionQueryOptions,
  sourceControlRepositoriesQueryOptions,
} from "./source-control-queries";

interface SourceControlSettingsClientProps {
  slug: string;
}

export function SourceControlSettingsClient({
  slug,
}: SourceControlSettingsClientProps) {
  const {
    data: sourceControlConnection,
    error: connectionError,
    isPending: isConnectionPending,
  } = useQuery(sourceControlConnectionQueryOptions());
  const {
    data: sourceControlRepositories,
    error: repositoriesError,
    isPending: isRepositoriesPending,
  } = useQuery(sourceControlRepositoriesQueryOptions());

  const connection = sourceControlConnection?.binding ?? null;
  const isPending = isConnectionPending || isRepositoriesPending;
  const error = connectionError ?? repositoriesError;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Source Control &amp; Git
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your GitHub connection and the repositories Lightfast can
          access.
        </p>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-[12px]" />
          <Skeleton className="h-36 rounded-[12px]" />
        </div>
      ) : error ? (
        <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {error.message}
        </div>
      ) : connection && sourceControlRepositories ? (
        <>
          <SourceControlConnectionCard connection={connection} orgSlug={slug} />
          <RepositoryList repositories={sourceControlRepositories} />
        </>
      ) : (
        <div className="rounded-[12px] border border-border bg-background p-4">
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
            <Button
              asChild
              className="h-7 rounded-[9px]"
              size="sm"
              variant="secondary"
            >
              <Link params={{ slug }} preload="intent" to="/$slug/tasks/bind">
                <ExternalLink aria-hidden="true" className="size-4" />
                Open setup
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
