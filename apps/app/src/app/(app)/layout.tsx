import { TRPCReactProvider } from "@repo/app-trpc/react";
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  prefetch(
    trpc.viewer.organization.listUserOrganizations.queryOptions()
  );
  prefetch(trpc.viewer.account.get.queryOptions());

  return (
    <NuqsAdapter>
      <TRPCReactProvider>
        <PageErrorBoundary fallbackTitle="Failed to load application">
          <div className="dark flex h-screen flex-col overflow-hidden bg-background">
            <HydrateClient>
              {children}
              <Toaster />
            </HydrateClient>
          </div>
        </PageErrorBoundary>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
