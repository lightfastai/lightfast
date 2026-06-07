import { pathForSetupRequirement } from "@repo/app-setup-contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { XConnectorSetupClient } from "~/org/setup/x-connector-setup-client";
import { useTRPC } from "~/trpc/react";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/connectors/x"
)({
  loader: ({ params }) =>
    loadRoutePrefetch({
      data: { route: "tasks.xConnector", slug: params.slug },
    }),
  head: ({ params }) => ({
    meta: [{ title: `Connect X - ${params.slug} - Lightfast` }],
  }),
  component: XConnectorSetupPage,
});

function XConnectorSetupPage() {
  const prefetchState = Route.useLoaderData();
  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <XConnectorSetupPageContent />
    </RoutePrefetchBoundary>
  );
}

function XConnectorSetupPageContent() {
  const { slug } = Route.useParams();
  const trpc = useTRPC();
  const { data: gate, isPending } = useQuery({
    ...trpc.viewer.organization.getBySlug.queryOptions({ slug }),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
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
