"use client";

import type { AppRouterOutputs } from "@api/app";
import { MarkdownContent } from "@repo/ui/components/markdown-content";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

type IdentitySettingsData =
  AppRouterOutputs["org"]["settings"]["identity"]["get"];
type IdentitySettingsFile = IdentitySettingsData["files"][number];

interface IdentitySettingsSectionProps {
  identity: IdentitySettingsData;
}

const statusLabels: Record<IdentitySettingsFile["status"], string> = {
  missing: "Missing",
  present: "Present",
  read_error: "Read error",
  too_large: "Too large",
};

export function IdentitySettingsSection({
  identity,
}: IdentitySettingsSectionProps) {
  const sourceUrlBase = `https://github.com/${identity.repository.owner}/${identity.repository.name}/blob/main/`;

  return (
    <div className="space-y-8">
      {identity.files.map((file) => (
        <IdentityFileSection
          file={file}
          key={file.kind}
          sourceUrlBase={sourceUrlBase}
        />
      ))}
    </div>
  );
}

function IdentityFileSection({
  file,
  sourceUrlBase,
}: {
  file: IdentitySettingsFile;
  sourceUrlBase: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPresent = file.status === "present" && !!file.sourceMarkdown;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground text-xl">
            {file.label}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">{file.path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-muted-foreground text-xs">
            {statusLabels[file.status]}
          </span>
          <Button asChild size="sm" variant="ghost">
            <a href={file.githubUrl} rel="noreferrer" target="_blank">
              View on GitHub
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30">
        <div className={expanded ? "p-4" : "max-h-[240px] overflow-hidden p-4"}>
          {isPresent ? (
            <MarkdownContent
              className="text-sm"
              sourcePath={file.path}
              sourceUrlBase={sourceUrlBase}
            >
              {file.sourceMarkdown ?? ""}
            </MarkdownContent>
          ) : (
            <MissingFileBlock file={file} />
          )}
        </div>
        {isPresent ? (
          <div className="flex items-center justify-between border-border border-t px-4 py-2">
            <p className="text-muted-foreground text-xs">
              Indexed commit {file.indexedCommitSha?.slice(0, 12) ?? "unknown"}
            </p>
            <Button
              onClick={() => setExpanded((value) => !value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        ) : null}
      </div>

      {file.diagnostics.length > 0 ? (
        <ul className="space-y-1 text-muted-foreground text-xs">
          {file.diagnostics.map((diagnostic) => (
            <li key={diagnostic}>{diagnostic}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function MissingFileBlock({ file }: { file: IdentitySettingsFile }) {
  const copy =
    file.kind === "identity"
      ? {
          body: "Add IDENTITY.md to your .lightfast repository to give Signal AI organization-authored context.",
          title: "IDENTITY.md is missing",
        }
      : {
          body: "Add SOUL.md to define the organization's voice for future chat and agent experiences.",
          title: "SOUL.md is missing",
        };

  return (
    <div className="space-y-1">
      <p className="font-medium text-foreground text-sm">{copy.title}</p>
      <p className="text-muted-foreground text-sm">{copy.body}</p>
    </div>
  );
}
