"use client";

import type { AppRouterOutputs } from "@api/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatStatusSubtitle } from "./source-control-format";

type SourceControlConnection = NonNullable<
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"]
>;

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function LightfastRepositoryCard({
  connection,
  orgSlug,
}: {
  connection: SourceControlConnection;
  orgSlug: string;
}) {
  const repository = connection.lightfastRepository;
  const name = repository
    ? repository.fullName
    : `${connection.accountLogin}/${LIGHTFAST_REPOSITORY_NAME}`;
  const description = repository
    ? "The repository Lightfast uses to coordinate workspace automation."
    : `Create and verify the ${LIGHTFAST_REPOSITORY_NAME} repository to unlock workspace automation.`;
  const subtitle = repository
    ? formatStatusSubtitle("Verified", repository.verifiedAt)
    : null;

  return (
    <section className="flex items-center justify-between gap-4 rounded-[8px] border border-border bg-background p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-input bg-background">
          <Icons.logoShort
            aria-hidden="true"
            className="size-4 text-foreground"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">
            {subtitle ?? description}
          </p>
        </div>
      </div>

      {repository ? (
        <StatusBadge label="Verified" />
      ) : (
        <Button
          asChild
          className="h-7 rounded-[9px]"
          size="sm"
          variant="outline"
        >
          <Link href={`/${orgSlug}/tasks/github/lightfast-repo` as Route}>
            <ExternalLink aria-hidden="true" className="size-3.5" />
            Open setup
          </Link>
        </Button>
      )}
    </section>
  );
}
