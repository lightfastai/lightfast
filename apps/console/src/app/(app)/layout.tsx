import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prefetch, HydrateClient, userTrpc, orgTrpc } from "@repo/console-trpc/server";
import { AppHeader } from "~/components/app-header";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(userTrpc.organization.listUserOrganizations.queryOptions());

  return (
    <PageErrorBoundary fallbackTitle="Failed to load application">
      <div className="dark h-screen flex flex-col overflow-hidden">
        {/* HydrateClient only for AppHeader (uses prefetched org data) */}
        <HydrateClient>
          <AppHeader />
        </HydrateClient>
        {/* Children handle their own prefetch + HydrateClient */}
        <div className="flex-1 flex overflow-hidden">{children}</div>
      </div>
    </PageErrorBoundary>
  );
}
