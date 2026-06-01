"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { GithubAccountCard } from "./github-account-card";

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";

export function AccountSourceControlClient() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.viewer.githubAccount.status.queryOptions()
  );
  const account = data.account;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Source Control &amp; Git
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Connect your personal GitHub identity so Lightfast can set up
          user-level source-control access for future workflows that act on your
          behalf.
        </p>
      </div>

      {account ? (
        <GithubAccountCard account={account} />
      ) : (
        <div className="rounded-[8px] border border-border bg-background p-4">
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
                href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }}
                prefetch={true}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Connect GitHub account
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
