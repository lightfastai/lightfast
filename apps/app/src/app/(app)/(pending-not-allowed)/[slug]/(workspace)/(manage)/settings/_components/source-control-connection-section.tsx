"use client";

import type { AppRouterOutputs } from "@api/app";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

type SourceControlConnection =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"];

interface SourceControlConnectionSectionProps {
  connection: SourceControlConnection;
  orgSlug: string;
}

const connectionDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "Not available";
}

export function SourceControlConnectionSection({
  connection,
  orgSlug,
}: SourceControlConnectionSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-foreground text-xl">
          GitHub connection
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Read-only source-control connection details for this team.
        </p>
      </div>

      {connection ? (
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
                  {displayValue(connection.accountLogin)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {connection.providerLabel} organization
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
              Connected
            </span>
          </div>

          <dl className="mt-5 grid gap-4">
            <div>
              <dt className="text-muted-foreground text-xs">Connected at</dt>
              <dd className="mt-1 text-foreground text-sm">
                <time dateTime={connection.connectedAt.toISOString()}>
                  {connectionDateFormatter.format(connection.connectedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </div>
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
