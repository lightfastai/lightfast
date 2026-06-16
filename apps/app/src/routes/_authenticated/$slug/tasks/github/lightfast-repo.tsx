import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LightfastRepoSetupClient } from "~/org/setup/lightfast-repo-setup-client";
import { useTRPC } from "~/trpc/react";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute(
  "/_authenticated/$slug/tasks/github/lightfast-repo"
)({
  loader: ({ params }) =>
    loadRoutePrefetch({
      data: { route: "tasks.lightfastRepo", slug: params.slug },
    }),
  head: ({ params }) => ({
    meta: [{ title: `.lightfast Repository - ${params.slug} - Lightfast` }],
  }),
  component: LightfastRepoSetupPage,
});

function LightfastRepoSetupPage() {
  const prefetchState = Route.useLoaderData();
  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <LightfastRepoSetupPageContent />
    </RoutePrefetchBoundary>
  );
}

function LightfastRepoSetupPageContent() {
  const { slug } = Route.useParams();
  const trpc = useTRPC();
  const { data: gate, isPending: isGatePending } = useQuery({
    ...trpc.viewer.organization.getBySlug.queryOptions({ slug }),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });
  const { data: sourceControl, isPending: isSourceControlPending } = useQuery({
    ...trpc.org.settings.sourceControl.get.queryOptions(),
    enabled: typeof window !== "undefined",
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
