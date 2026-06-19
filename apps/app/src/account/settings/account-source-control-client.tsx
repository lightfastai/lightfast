import { ExternalLinkIcon as ExternalLink } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { githubAccountStatusQueryOptions } from "../account-queries";
import { GithubAccountCard } from "./github-account-card";

export function AccountSourceControlClient() {
  const { data, isPending } = useQuery(githubAccountStatusQueryOptions());

  const account = data?.account;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-title text-2xl text-foreground">
          Source Control &amp; Git
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Connect your personal GitHub identity so Lightfast can set up
          user-level source-control access for future workflows that act on your
          behalf.
        </p>
      </div>

      {isPending ? (
        <Skeleton className="h-24 rounded-[12px]" />
      ) : account ? (
        <GithubAccountCard account={account} />
      ) : (
        <div className="rounded-[12px] border border-border bg-background p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">
                No GitHub account connected
              </p>
              <p className="text-muted-foreground text-sm">
                Setup is optional today. Future GitHub-powered actions will ask
                for this connection before they run as your GitHub user.
              </p>
            </div>
            <Button
              asChild
              className="h-7 rounded-[9px]"
              size="sm"
              variant="secondary"
            >
              <Link
                preload="intent"
                search={{ github_error: undefined }}
                to="/account/tasks/github"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={ExternalLink}
                />
                Connect GitHub account
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
