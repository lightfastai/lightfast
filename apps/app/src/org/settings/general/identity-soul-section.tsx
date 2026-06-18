import {
  ExternalLinkIcon as ExternalLink,
  File02Icon as FileText,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type {
  ConfiguredOrgIdentitySettings,
  OrgIdentitySettingsFile,
} from "./identity-soul-queries";

type IdentitySettingsData = ConfiguredOrgIdentitySettings;
type IdentitySettingsFile = OrgIdentitySettingsFile;

function SectionHeader() {
  return (
    <div>
      <h2 className="font-semibold text-base text-foreground">
        Identity &amp; Soul
      </h2>
    </div>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground">
      {children}
    </span>
  );
}

function IndexStatusBadge({ indexed }: { indexed: boolean }) {
  return (
    <Badge
      className={cn(
        "shrink-0 gap-1.5",
        indexed
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
      variant="outline"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {indexed ? "Indexed" : "Not indexed"}
    </Badge>
  );
}

function IdentityFileRow({ file }: { file: IdentitySettingsFile }) {
  const indexed = file.status === "present";
  const subtitle = indexed
    ? `Indexed commit ${file.indexedCommitSha?.slice(0, 7) ?? "unknown"}`
    : `Add ${file.path} to .lightfast`;

  return (
    <div className="flex items-center justify-between gap-4 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile>
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-foreground"
            icon={FileText}
          />
        </IconTile>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">{file.path}</p>
          <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IndexStatusBadge indexed={indexed} />
        {indexed ? (
          <Button
            asChild
            className="h-7 rounded-[9px]"
            size="sm"
            variant="ghost"
          >
            <a href={file.githubUrl} rel="noreferrer" target="_blank">
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5"
                icon={ExternalLink}
              />
              View
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function IdentitySoulSection({
  identity,
}: {
  identity: IdentitySettingsData;
}) {
  return (
    <section>
      <SectionHeader />

      <section className="mt-4 divide-y divide-border rounded-[12px] border border-border bg-background">
        {identity.files.map((file) => (
          <IdentityFileRow file={file} key={file.kind} />
        ))}
      </section>
    </section>
  );
}

const EMPTY_PLACEHOLDERS = [
  { hint: "Organization context", path: "IDENTITY.md" },
  { hint: "Voice & tone", path: "SOUL.md" },
];

export function IdentitySoulEmptyState({ slug }: { slug: string }) {
  return (
    <section>
      <SectionHeader />

      <section className="mt-4 divide-y divide-border rounded-[12px] border border-border border-dashed bg-background">
        {EMPTY_PLACEHOLDERS.map((placeholder) => (
          <div
            className="flex items-center justify-between gap-4 p-3 opacity-60"
            key={placeholder.path}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border border-dashed text-muted-foreground">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={FileText}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-foreground text-sm">
                  {placeholder.path}
                </p>
                <p className="truncate text-muted-foreground text-xs">
                  {placeholder.hint}
                </p>
              </div>
            </div>
            <Badge
              className="shrink-0 gap-1.5 border-border bg-muted/40 text-muted-foreground"
              variant="outline"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-current"
              />
              Not configured
            </Badge>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 p-3">
          <p className="text-muted-foreground text-xs">
            Set up <code className="font-mono">.lightfast</code> to start
            indexing
          </p>
          <Button
            asChild
            className="h-7 shrink-0 rounded-[9px]"
            size="sm"
            variant="secondary"
          >
            <Link
              params={{ slug }}
              preload="intent"
              to="/$slug/settings/source-control"
            >
              Set up
            </Link>
          </Button>
        </div>
      </section>
    </section>
  );
}
