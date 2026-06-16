import { createFileRoute } from "@tanstack/react-router";
import { AccountSourceControlClient } from "~/account/settings/account-source-control-client";
import {
  loadRoutePrefetch,
  RoutePrefetchBoundary,
} from "~/trpc/route-prefetch";

export const Route = createFileRoute(
  "/_authenticated/account/settings/source-control"
)({
  loader: () =>
    loadRoutePrefetch({ data: { route: "account.settings.sourceControl" } }),
  head: () => ({
    meta: [
      { title: "Source Control Account Settings - Lightfast" },
      {
        name: "description",
        content: "Connect your GitHub account to Lightfast.",
      },
    ],
  }),
  component: AccountSourceControlSettingsPage,
});

function AccountSourceControlSettingsPage() {
  const prefetchState = Route.useLoaderData();

  return (
    <RoutePrefetchBoundary state={prefetchState}>
      <AccountSourceControlClient />
    </RoutePrefetchBoundary>
  );
}
