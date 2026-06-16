import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { AutomationDetailClient } from "~/automations/automation-detail-client";
import {
  WorkspaceRouteErrorPanel,
  WorkspaceRoutePending,
} from "~/components/route-boundaries";

function validateAutomationDetailSearch(search: Record<string, unknown>) {
  const run = typeof search.run === "string" ? search.run : undefined;
  return {
    run: run && run !== "null" && run.length > 0 ? run : undefined,
  };
}

export const Route = createFileRoute(
  "/_authenticated/$slug/automations/$automation"
)({
  validateSearch: validateAutomationDetailSearch,
  head: ({ params }) => ({
    meta: [{ title: `Automation - ${params.slug} - Lightfast` }],
  }),
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: AutomationDetailRoutePending,
  errorComponent: AutomationDetailRouteError,
  component: AutomationDetailPage,
});

function AutomationDetailRoutePending() {
  return <WorkspaceRoutePending label="Loading automation" />;
}

function AutomationDetailRouteError({
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
      description="It may have been deleted, or there was a transient error."
      error={error}
      maxWidth="max-w-5xl"
      reset={reset}
      route="automations/[automationId]"
      title="Couldn't load automation"
    />
  );
}

function AutomationDetailPage() {
  const { automation: automationId, slug } = Route.useParams();
  const { run } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSelectedRunId = useCallback(
    (publicId: string | null) => {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          run: publicId ?? undefined,
        }),
      });
    },
    [navigate]
  );

  return (
    <AutomationDetailClient
      automationId={automationId}
      selectedRunId={run ?? null}
      setSelectedRunId={setSelectedRunId}
      slug={slug}
    />
  );
}
