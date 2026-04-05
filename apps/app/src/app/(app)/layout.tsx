import { TRPCReactProvider } from "@repo/app-trpc/react";
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(trpc.organization.listUserOrganizations.queryOptions());
  // Prefetch user profile for header + notifications (shared across all authenticated pages)
  prefetch(trpc.account.get.queryOptions());

  return (
    <NuqsAdapter>
      <TRPCReactProvider>
        <PageErrorBoundary fallbackTitle="Failed to load application">
          <div className="dark flex h-screen flex-col overflow-hidden">
            <HydrateClient>
              <Suspense fallback={null}>
                <ConsoleNotificationsProvider>
                  <div className="flex flex-1 overflow-hidden">{children}</div>
                  <Toaster />
                </ConsoleNotificationsProvider>
              </Suspense>
            </HydrateClient>
          </div>
        </PageErrorBoundary>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
