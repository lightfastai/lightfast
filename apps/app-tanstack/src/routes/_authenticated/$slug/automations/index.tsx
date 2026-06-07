import { createFileRoute } from "@tanstack/react-router";
import { AutomationsClient } from "~/automations/automations-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/automations/")({
  loader: () => loadRoutePrefetch({ data: { route: "automations.list" } }),
  head: ({ params }) => ({
    meta: [{ title: `Automations - ${params.slug} - Lightfast` }],
  }),
  component: AutomationsPage,
});

function AutomationsPage() {
  const { slug } = Route.useParams();
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <AutomationsClient slug={slug} />
    </RoutePrefetchBoundary>
  );
}
