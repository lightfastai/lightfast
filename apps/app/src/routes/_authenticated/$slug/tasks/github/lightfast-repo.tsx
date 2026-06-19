import { getSourceControlConnection } from "@api/app/tanstack/source-control";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { sourceControlConnectionQueryKey } from "~/org/settings/source-control/source-control-cache";
import { LightfastRepoSetupClient } from "~/org/setup/lightfast-repo-setup-client";
import { organizationBySlugQueryOptions } from "~/organization/organization-queries";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/github/lightfast-repo"
)({
  head: ({ params }) => ({
    meta: [{ title: `.lightfast Repository - ${params.slug} - Lightfast` }],
  }),
  component: LightfastRepoSetupPage,
});

function LightfastRepoSetupPage() {
  return <LightfastRepoSetupPageContent />;
}

function LightfastRepoSetupPageContent() {
  const { slug } = Route.useParams();
  const { data: gate, isPending: isGatePending } = useQuery({
    ...organizationBySlugQueryOptions({ slug }),
  });
  const { data: sourceControl, isPending: isSourceControlPending } = useQuery({
    queryFn: () => getSourceControlConnection(),
    queryKey: sourceControlConnectionQueryKey,
    staleTime: 30_000,
  });
  const accountLogin = sourceControl?.binding?.accountLogin;
  const newRepositoryUrl = sourceControl?.binding?.newLightfastRepositoryUrl;

  if (isGatePending || isSourceControlPending) {
    return <SetupPageSkeleton label="Loading repository setup" />;
  }

  if (gate?.bindingStatus === "bound") {
    return (
      <Navigate
        params={{ slug }}
        replace
        to="/$slug/tasks/bind/github/complete"
      />
    );
  }

  if (gate?.nextSetupRequirement === "github_org") {
    return <Navigate params={{ slug }} replace to="/$slug/tasks/bind" />;
  }

  if (!accountLogin) {
    return <Navigate params={{ slug }} replace to="/$slug/tasks/bind" />;
  }
  if (!newRepositoryUrl) {
    return <SetupPageSkeleton label="Loading repository setup" />;
  }

  return (
    <LightfastRepoSetupClient
      accountLogin={accountLogin}
      newRepositoryUrl={newRepositoryUrl}
      orgSlug={slug}
    />
  );
}

function SetupPageSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="grid min-h-full flex-1 place-items-center px-4 pb-32"
      role="status"
    >
      <div className="h-5 w-40 rounded-md bg-muted" />
    </div>
  );
}
