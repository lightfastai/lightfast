import { getOrganizationBySlug } from "@api/app/tanstack/organizations";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { pathForSetupRequirement } from "~/org/setup/setup-paths";
import { XConnectorSetupClient } from "~/org/setup/x-connector-setup-client";
import {
  ORGANIZATION_STALE_TIME,
  organizationQueryKeys,
} from "~/organization/organization-cache";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/connectors/x/"
)({
  head: ({ params }) => ({
    meta: [{ title: `Connect X - ${params.slug} - Lightfast` }],
  }),
  component: XConnectorSetupPage,
});

function XConnectorSetupPage() {
  return <XConnectorSetupPageContent />;
}

function XConnectorSetupPageContent() {
  const { slug } = Route.useParams();
  const { data: gate, isPending } = useQuery({
    enabled: typeof window !== "undefined",
    queryFn: () => getOrganizationBySlug({ data: { slug } }),
    queryKey: organizationQueryKeys.bySlug(slug),
    staleTime: ORGANIZATION_STALE_TIME,
  });

  if (isPending) {
    return <SetupPageSkeleton label="Loading X setup" />;
  }

  if (gate?.bindingStatus === "bound") {
    return (
      <Navigate
        params={{ slug }}
        replace
        to="/$slug/tasks/connectors/x/complete"
      />
    );
  }

  if (gate?.nextSetupRequirement === "github_org") {
    pathForSetupRequirement({ orgSlug: slug, requirement: "github_org" });
    return <Navigate params={{ slug }} replace to="/$slug/tasks/bind" />;
  }

  if (gate?.nextSetupRequirement === "github_lightfast_repo") {
    pathForSetupRequirement({
      orgSlug: slug,
      requirement: "github_lightfast_repo",
    });
    return (
      <Navigate
        params={{ slug }}
        replace
        to="/$slug/tasks/github/lightfast-repo"
      />
    );
  }

  return <XConnectorSetupClient orgSlug={slug} />;
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
