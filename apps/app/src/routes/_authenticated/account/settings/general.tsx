import { createFileRoute } from "@tanstack/react-router";
import { ProfileDataDisplay } from "~/account/settings/profile-data-display";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute(
  "/_authenticated/account/settings/general"
)({
  loader: () =>
    loadRoutePrefetch({ data: { route: "account.settings.general" } }),
  head: () => ({
    meta: [
      { title: "General Account Settings - Lightfast" },
      {
        name: "description",
        content: "Manage your Lightfast profile settings.",
      },
    ],
  }),
  component: GeneralAccountSettingsPage,
});

function GeneralAccountSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <ProfileDataDisplay />
    </RoutePrefetchBoundary>
  );
}
