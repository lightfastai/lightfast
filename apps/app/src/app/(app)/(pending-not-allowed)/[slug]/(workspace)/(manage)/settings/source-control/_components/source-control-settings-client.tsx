"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { LightfastRepositoryCard } from "./lightfast-repository-card";
import { OrganizationCard } from "./organization-card";
import { RepositoryList } from "./repository-list";

interface SourceControlSettingsClientProps {
  slug: string;
}

export function SourceControlSettingsClient({
  slug,
}: SourceControlSettingsClientProps) {
  const trpc = useTRPC();

  const { data: sourceControlConnection } = useSuspenseQuery(
    trpc.org.settings.sourceControl.get.queryOptions()
  );
  const { data: sourceControlRepositories } = useSuspenseQuery(
    trpc.org.settings.sourceControl.listRepositories.queryOptions()
  );

  const connection = sourceControlConnection.binding;

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

      {connection ? (
        <>
          <OrganizationCard connection={connection} />
          <LightfastRepositoryCard connection={connection} orgSlug={slug} />
          <RepositoryList repositories={sourceControlRepositories} />
        </>
      ) : (
        <div className="rounded-[8px] border border-border bg-background p-4">
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
              <Link href={`/${slug}/tasks/bind` as Route}>
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
