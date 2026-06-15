import { createFileRoute } from "@tanstack/react-router";
import { IdentitySoulCard } from "~/org/settings/general/identity-soul-card";
import { TeamGeneralSettingsClient } from "~/org/settings/general/team-general-settings-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute("/_authenticated/$slug/settings/general")({
  loader: ({ params }) =>
    loadRoutePrefetch({
      data: { route: "org.settings.general", slug: params.slug },
    }),
  head: ({ params }) => ({
    meta: [
      { title: `General Settings - ${params.slug} - Lightfast` },
      {
        name: "description",
        content: "Manage your Lightfast workspace profile and preferences.",
      },
    ],
  }),
  component: GeneralSettingsPage,
});

function GeneralSettingsPage() {
  const prefetchState = Route.useLoaderData();
  const { slug } = Route.useParams();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <div className="space-y-10">
        <div>
          <h2 className="font-medium font-pp text-2xl text-foreground">
            General
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage your team's profile and preferences.
          </p>
        </div>

        <TeamGeneralSettingsClient slug={slug} />
        <IdentitySoulCard slug={slug} />
      </div>
    </RoutePrefetchBoundary>
  );
}
