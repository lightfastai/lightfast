"use client";

import type { AppRouterOutputs } from "@api/app";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { WorkspaceSurface } from "~/components/workspace-surface";
import { useTRPC } from "~/trpc/react";
import { getSkillSourceUrl, SkillMarkdown } from "./skill-markdown";
import { SkillStatus } from "./skill-status";

type SkillGetResult = AppRouterOutputs["org"]["workspace"]["skills"]["get"];
type Skill = SkillGetResult["skill"];

export function SkillDetail({ skillSlug }: { skillSlug: string }) {
  const params = useParams<{ slug: string }>();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.get.queryOptions(
      { slug: skillSlug },
      { staleTime: 0 }
    )
  );
  const sourceUrl = getSkillSourceUrl({
    repositoryUrl: data.repositoryUrl,
    skill: data.skill,
  });

  return (
    <WorkspaceSurface className="max-w-6xl" variant="contained">
      <Link
        className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        href={`/${params.slug}/skills` as Route}
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-semibold text-2xl text-foreground">
              {data.skill.name ?? data.skill.slug}
            </h1>
            <Badge
              variant={
                data.skill.validationStatus === "valid"
                  ? "secondary"
                  : "outline"
              }
            >
              {data.skill.validationStatus}
            </Badge>
          </div>
          {data.skill.description && (
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              {data.skill.description}
            </p>
          )}
          <SkillStatus freshness={data.freshness} />
        </div>

        {sourceUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
              <ExternalLink className="size-3.5" />
              View source
            </a>
          </Button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 rounded-lg border border-border/70 bg-muted/10 p-5">
          <SkillMarkdown
            repositoryUrl={data.repositoryUrl}
            skill={data.skill}
          />
        </section>

        <aside className="space-y-6">
          <MetadataSection skill={data.skill} />
          <DiagnosticsSection diagnostics={data.skill.diagnostics} />
          <ResourcesSection
            repositoryUrl={data.repositoryUrl}
            skill={data.skill}
          />
        </aside>
      </div>
    </WorkspaceSurface>
  );
}

function MetadataSection({ skill }: { skill: Skill }) {
  const entries = [
    ["Slug", skill.slug],
    ["Path", skill.path],
    ["Content size", skill.contentSize ? `${skill.contentSize} bytes` : null],
    ["License", skill.license],
    ["Compatibility", skill.compatibility],
    ["Allowed tools", skill.allowedTools],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <section className="border-border/70 border-t pt-4">
      <h2 className="font-medium text-foreground text-sm">Metadata</h2>
      <dl className="mt-3 space-y-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="break-words text-foreground text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DiagnosticsSection({
  diagnostics,
}: {
  diagnostics: Skill["diagnostics"];
}) {
  return (
    <section className="border-border/70 border-t pt-4">
      <h2 className="font-medium text-foreground text-sm">Diagnostics</h2>
      {diagnostics.length === 0 ? (
        <p className="mt-2 text-muted-foreground text-sm">No diagnostics.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {diagnostics.map((diagnostic) => (
            <li
              className="rounded-md border border-border/70 p-3 text-sm"
              key={`${diagnostic.code}:${diagnostic.message}`}
            >
              <p className="font-mono text-muted-foreground text-xs">
                {diagnostic.code}
              </p>
              <p className="mt-1 text-foreground">{diagnostic.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResourcesSection({
  repositoryUrl,
  skill,
}: {
  repositoryUrl: string;
  skill: Skill;
}) {
  const groups = [
    ["References", skill.resources.references],
    ["Scripts", skill.resources.scripts],
    ["Assets", skill.resources.assets],
  ] as const;

  return (
    <section className="border-border/70 border-t pt-4">
      <h2 className="font-medium text-foreground text-sm">Resources</h2>
      <div className="mt-3 space-y-4">
        {groups.map(([label, paths]) => (
          <div key={label}>
            <p className="text-muted-foreground text-xs">{label}</p>
            {paths.length === 0 ? (
              <p className="mt-1 text-muted-foreground text-sm">None</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {paths.map((path) => (
                  <li key={path}>
                    <a
                      className="break-all text-primary text-sm underline underline-offset-2"
                      href={getResourceUrl({ path, repositoryUrl, skill })}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {path}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function getResourceUrl({
  path,
  repositoryUrl,
  skill,
}: {
  path: string;
  repositoryUrl: string;
  skill: Pick<Skill, "indexedCommitSha">;
}) {
  return `${repositoryUrl.replace(/\/+$/, "")}/blob/${skill.indexedCommitSha}/${path}`;
}
