import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(userTrpc.organization.listUserOrganizations.queryOptions());

  return (
    <PageErrorBoundary fallbackTitle="Failed to load application">
      <div className="dark h-screen flex flex-col overflow-hidden">
        {/* HydrateClient for prefetched org data */}
        <HydrateClient>
          <ConsoleNotificationsProvider>
            {/* Children handle their own layout with header */}
            <div className="flex-1 flex overflow-hidden">{children}</div>
          </ConsoleNotificationsProvider>
        </HydrateClient>
      </div>
    </PageErrorBoundary>
  );
}
