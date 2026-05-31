"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";

const GITHUB_ACCOUNT_TASK_HREF = "/account/tasks/github";

export function GithubAccountConnectionSection() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.viewer.githubAccount.status.queryOptions()
  );
  const account = data.account;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            GitHub account
          </h2>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm">
            Connect your personal GitHub identity so Lightfast can set up
            user-level source-control access for future workflows that act on
            your behalf.
          </p>
        </div>

        <Button asChild className="w-full sm:w-auto" variant="secondary">
          <Link href={{ pathname: GITHUB_ACCOUNT_TASK_HREF }} prefetch={true}>
            <Icons.github aria-hidden="true" className="h-4 w-4" />
            {account ? "View GitHub setup" : "Connect GitHub account"}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        {account ? (
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-foreground"
            />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Connected</p>
              <p className="truncate font-mono text-muted-foreground">
                {account.provider}:{account.providerUserId}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            <p className="font-medium text-foreground">Not connected</p>
            <p className="mt-1 text-muted-foreground">
              Setup is optional today. Future GitHub-powered actions will ask
              for this connection before they run as your GitHub user.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
