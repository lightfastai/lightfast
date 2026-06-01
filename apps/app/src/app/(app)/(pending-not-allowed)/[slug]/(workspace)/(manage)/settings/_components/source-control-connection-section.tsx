"use client";

import type { AppRouterOutputs } from "@api/app";
import { LIGHTFAST_REPOSITORY_NAME } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingRow, SettingsGroup } from "./settings-section";

type SourceControlConnection =
  AppRouterOutputs["org"]["settings"]["sourceControl"]["get"]["binding"];

interface SourceControlSectionProps {
  connection: SourceControlConnection;
  orgSlug: string;
}

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

function isValidDate(value: Date) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : "Not available";
}

function formatStatusSubtitle(verb: string, value: Date) {
  if (!isValidDate(value)) {
    return null;
  }
  return `${verb} ${shortDateFormatter.format(value)}`;
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function ConnectionStatus({
  icon,
  name,
  status,
  subtitle,
}: {
  icon: ReactNode;
  name: string;
  status: string;
  subtitle: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-input bg-background">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-foreground text-sm">{name}</p>
        {subtitle ? (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        ) : null}
      </div>
      <StatusBadge label={status} />
    </div>
  );
}

function OpenSetupButton({ href, label }: { href: Route; label: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <ExternalLink aria-hidden="true" className="size-3.5" />
        {label}
      </Link>
    </Button>
  );
}

export function SourceControlSection({
  connection,
  orgSlug,
}: SourceControlSectionProps) {
  const repository = connection?.lightfastRepository ?? null;

  let repositoryDescription: string;
  if (repository) {
    repositoryDescription =
      "The repository Lightfast uses to coordinate workspace automation.";
  } else if (connection) {
    repositoryDescription = `Create and verify the ${LIGHTFAST_REPOSITORY_NAME} repository to unlock workspace automation.`;
  } else {
    repositoryDescription = `Connect a GitHub organization before verifying the ${LIGHTFAST_REPOSITORY_NAME} repository.`;
  }

  return (
    <SettingsGroup title="Source control">
      <SettingRow
        description={
          connection
            ? "Read-only source-control connection for this team."
            : "Connect GitHub from setup before workspace features can use source-control data."
        }
        label="GitHub connection"
      >
        {connection ? (
          <ConnectionStatus
            icon={
              <Icons.github
                aria-hidden="true"
                className="size-4 text-foreground"
              />
            }
            name={displayValue(connection.accountLogin)}
            status="Connected"
            subtitle={formatStatusSubtitle("Connected", connection.connectedAt)}
          />
        ) : (
          <OpenSetupButton
            href={`/${orgSlug}/tasks/bind` as Route}
            label="Open setup"
          />
        )}
      </SettingRow>

      <SettingRow
        description={repositoryDescription}
        label="Lightfast repository"
      >
        {repository ? (
          <ConnectionStatus
            icon={
              <Icons.logoShort
                aria-hidden="true"
                className="size-4 text-foreground"
              />
            }
            name={repository.fullName}
            status="Verified"
            subtitle={formatStatusSubtitle("Verified", repository.verifiedAt)}
          />
        ) : connection ? (
          <OpenSetupButton
            href={`/${orgSlug}/tasks/github/lightfast-repo` as Route}
            label="Open setup"
          />
        ) : (
          <OpenSetupButton
            href={`/${orgSlug}/tasks/bind` as Route}
            label="Connect GitHub"
          />
        )}
      </SettingRow>
    </SettingsGroup>
  );
}
