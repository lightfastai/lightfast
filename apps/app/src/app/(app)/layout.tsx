import { Toaster } from "@repo/ui/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { TRPCReactProvider } from "~/trpc/react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <TRPCReactProvider>
        <PageErrorBoundary fallbackTitle="Failed to load application">
          <div className="dark flex h-screen flex-col overflow-hidden bg-background">
            {children}
            <Toaster />
          </div>
        </PageErrorBoundary>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
