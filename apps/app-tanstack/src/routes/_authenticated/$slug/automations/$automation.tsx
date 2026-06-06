import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { AutomationDetailClient } from "~/automations/automation-detail-client";

function validateAutomationDetailSearch(search: Record<string, unknown>) {
  const run = typeof search.run === "string" ? search.run : null;
  return {
    run: run && run.length > 0 ? run : null,
  };
}

export const Route = createFileRoute(
  "/_authenticated/$slug/automations/$automation"
)({
  validateSearch: validateAutomationDetailSearch,
  head: ({ params }) => ({
    meta: [{ title: `Automation - ${params.slug} - Lightfast` }],
  }),
  component: AutomationDetailPage,
});

function AutomationDetailPage() {
  const { automation: automationId } = Route.useParams();
  const { run } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setSelectedRunId = useCallback(
    (publicId: string | null) => {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          run: publicId,
        }),
      });
    },
    [navigate]
  );

  return (
    <AutomationDetailClient
      automationId={automationId}
      selectedRunId={run}
      setSelectedRunId={setSelectedRunId}
    />
  );
}
