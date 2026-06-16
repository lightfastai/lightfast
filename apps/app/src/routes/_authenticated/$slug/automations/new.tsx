import { createFileRoute } from "@tanstack/react-router";
import { AutomationCreateForm } from "~/automations/automation-create-form";
import {
  AutomationFormRoutePending,
  WorkspaceRouteErrorPanel,
} from "~/components/route-boundaries";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/automations/new")({
  loader: () => loadRoutePrefetch({ data: { route: "automations.new" } }),
  head: ({ params }) => ({
    meta: [{ title: `New automation - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: AutomationFormRoutePending,
  errorComponent: NewAutomationRouteError,
  component: NewAutomationPage,
});

function NewAutomationRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { slug } = Route.useParams();

  return (
    <WorkspaceRouteErrorPanel
      backHref={`/${slug}/automations`}
      backLabel="Back to automations"
      description="There was a transient error while preparing the automation form."
      error={error}
      maxWidth="max-w-2xl"
      reset={reset}
      route="automations/new"
      title="Couldn't load new automation"
    />
  );
}

function NewAutomationPage() {
  const { slug } = Route.useParams();
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <AutomationCreateForm slug={slug} />
    </RoutePrefetchBoundary>
  );
}
