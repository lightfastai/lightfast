import { getOrganizationBySlug } from "@api/app/tanstack/organizations";
import { getSourceControlConnection } from "@api/app/tanstack/source-control";
import {
  ArrowRightIcon as ArrowRight,
  CheckmarkCircle02Icon as CheckCircle2,
  CircleDashedIcon as CircleDashed,
  GitBranchIcon as GitBranch,
  LockIcon as Lock,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { OrgSetupRequirement } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { ConnectorIcon } from "~/connectors/connector-icons";
import { sourceControlConnectionQueryKey } from "~/org/settings/source-control/source-control-cache";
import {
  ORGANIZATION_STALE_TIME,
  organizationQueryKeys,
} from "~/organization/organization-cache";

type SetupTaskStatus = "complete" | "current" | "locked";
const SETUP_REQUIREMENT_ORDER: OrgSetupRequirement[] = [
  "github_org",
  "github_lightfast_repo",
  "x_connector",
];

export const Route = createFileRoute("/_authenticated/$slug/tasks/")({
  head: ({ params }) => ({
    meta: [{ title: `Setup Tasks - ${params.slug} - Lightfast` }],
  }),
  component: SetupTasksPage,
});

function setupTaskStatus(input: {
  nextRequirement: OrgSetupRequirement;
  requirement: OrgSetupRequirement;
}): SetupTaskStatus {
  if (input.nextRequirement === input.requirement) {
    return "current";
  }
  if (
    SETUP_REQUIREMENT_ORDER.indexOf(input.requirement) <
    SETUP_REQUIREMENT_ORDER.indexOf(input.nextRequirement)
  ) {
    return "complete";
  }
  return "locked";
}

function SetupTasksPage() {
  return <SetupTasksPageContent />;
}

function SetupTasksPageContent() {
  const { slug } = Route.useParams();
  const { data: gate, isPending: isGatePending } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => getOrganizationBySlug({ data: { slug } }),
    queryKey: organizationQueryKeys.bySlug(slug),
    staleTime: ORGANIZATION_STALE_TIME,
  });
  const { data: sourceControl, isPending: isSourceControlPending } = useQuery({
    queryFn: () => getSourceControlConnection(),
    queryKey: sourceControlConnectionQueryKey,
    staleTime: 30_000,
  });

  if (isGatePending || isSourceControlPending) {
    return <SetupTasksSkeleton />;
  }

  if (gate?.bindingStatus === "bound") {
    return <Navigate params={{ slug }} replace to="/$slug" />;
  }

  const nextRequirement = gate?.nextSetupRequirement ?? "github_org";
  const githubOrgStatus = setupTaskStatus({
    nextRequirement,
    requirement: "github_org",
  });
  const lightfastRepoStatus = setupTaskStatus({
    nextRequirement,
    requirement: "github_lightfast_repo",
  });
  const xConnectorStatus = setupTaskStatus({
    nextRequirement,
    requirement: "x_connector",
  });
  const accountLogin = sourceControl?.binding?.accountLogin;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-12 pb-28">
      <div className="mb-6">
        <TeamSwitcherSlot />
      </div>
      <div className="mb-8 space-y-3">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-muted-foreground text-sm">/{slug}</p>
          <h1 className="font-medium font-pp text-2xl text-foreground">
            Complete setup
          </h1>
          <p className="max-w-xl text-muted-foreground text-sm leading-6">
            Connect source control and verify the workspace repository before
            Lightfast features unlock.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SetupTaskCard
          description="Bind this Lightfast team to one GitHub organization."
          href="/$slug/tasks/bind"
          icon={<Icons.github aria-hidden="true" className="size-4" />}
          params={{ slug }}
          status={githubOrgStatus}
          subtitle={
            accountLogin ? `Connected to ${accountLogin}` : "Required first"
          }
          title="Connect GitHub organization"
        />
        <SetupTaskCard
          description="Create and verify the .lightfast repository in the connected GitHub organization."
          href="/$slug/tasks/github/lightfast-repo"
          icon={
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4"
              icon={GitBranch}
            />
          }
          params={{ slug }}
          status={lightfastRepoStatus}
          subtitle={
            accountLogin ? `${accountLogin}/.lightfast` : "Connect GitHub first"
          }
          title="Verify .lightfast repository"
        />
        <SetupTaskCard
          description="Connect X so Lightfast can unlock the social signal source."
          href="/$slug/tasks/connectors/x"
          icon={<ConnectorIcon className="size-8" provider="x" />}
          params={{ slug }}
          status={xConnectorStatus}
          subtitle="Required after source control setup"
          title="Connect X"
        />
      </div>
    </main>
  );
}

function SetupTaskCard({
  description,
  href,
  icon,
  params,
  status,
  subtitle,
  title,
}: {
  description: string;
  href:
    | "/$slug/tasks/bind"
    | "/$slug/tasks/connectors/x"
    | "/$slug/tasks/github/lightfast-repo";
  icon: ReactNode;
  params: { slug: string };
  status: SetupTaskStatus;
  subtitle: string;
  title: string;
}) {
  const isLocked = status === "locked";

  return (
    <section
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border p-4",
        status === "current"
          ? "border-border bg-card"
          : "border-border/70 bg-muted/20",
        isLocked ? "opacity-70" : null
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-md border",
          status === "complete"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-border bg-background text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-medium text-foreground text-sm">
            {title}
          </h2>
          <SetupTaskStatusBadge status={status} />
        </div>
        <p className="text-muted-foreground text-sm leading-5">{description}</p>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {subtitle}
        </p>
      </div>
      {isLocked ? (
        <Button
          aria-label={`${title} locked`}
          className="size-8 rounded-lg"
          disabled
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" className="size-4" icon={Lock} />
        </Button>
      ) : (
        <Button asChild className="size-8 rounded-lg" size="icon-sm">
          <Link params={params} to={href}>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4"
              icon={ArrowRight}
            />
            <span className="sr-only">{title}</span>
          </Link>
        </Button>
      )}
    </section>
  );
}

function SetupTaskStatusBadge({ status }: { status: SetupTaskStatus }) {
  const label =
    status === "complete"
      ? "Complete"
      : status === "current"
        ? "Next"
        : "Locked";
  const icon =
    status === "complete"
      ? CheckCircle2
      : status === "current"
        ? CircleDashed
        : Lock;

  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-border/70 px-1.5 text-muted-foreground text-xs">
      <HugeiconsIcon aria-hidden="true" className="size-3" icon={icon} />
      {label}
    </span>
  );
}

function SetupTasksSkeleton() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-12 pb-28">
      <div className="mb-8 space-y-3">
        <Skeleton className="size-11 rounded-sm" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </main>
  );
}
