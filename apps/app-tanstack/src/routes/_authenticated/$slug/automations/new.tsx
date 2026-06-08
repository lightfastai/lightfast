import { createFileRoute } from "@tanstack/react-router";
import { AutomationCreateForm } from "~/automations/automation-create-form";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/automations/new")({
  loader: () => loadRoutePrefetch({ data: { route: "automations.new" } }),
  head: ({ params }) => ({
    meta: [{ title: `New automation - ${params.slug} - Lightfast` }],
  }),
  component: NewAutomationPage,
});

function NewAutomationPage() {
  const { slug } = Route.useParams();
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <AutomationCreateForm slug={slug} />
    </RoutePrefetchBoundary>
  );
}
