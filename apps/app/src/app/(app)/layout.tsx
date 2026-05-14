import { TRPCReactProvider } from "@repo/app-trpc/react";
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import {
  TeamSwitcher,
  TeamSwitcherSkeleton,
} from "~/components/team-switcher";
import { UserMenu, UserMenuSkeleton } from "~/components/user-menu";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  prefetch(
    trpc.pendingAllowed.organization.listUserOrganizations.queryOptions()
  );
  prefetch(trpc.pendingAllowed.account.get.queryOptions());

  return (
    <NuqsAdapter>
      <TRPCReactProvider>
        <PageErrorBoundary fallbackTitle="Failed to load application">
          <div className="dark flex h-screen flex-col overflow-hidden bg-background">
            <HydrateClient>
              <div className="flex h-14 shrink-0 items-center gap-3 px-4">
                <Suspense fallback={<TeamSwitcherSkeleton />}>
                  <TeamSwitcher />
                </Suspense>
                <div className="ml-auto flex items-center gap-3">
                  <MicrofrontendLink
                    className="text-muted-foreground text-sm hover:text-foreground"
                    href="/docs/get-started/overview"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Docs
                  </MicrofrontendLink>
                  <MicrofrontendLink
                    className="text-muted-foreground text-sm hover:text-foreground"
                    href="/docs/api-reference"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    API Reference
                  </MicrofrontendLink>
                  <Suspense fallback={<UserMenuSkeleton />}>
                    <UserMenu />
                  </Suspense>
                </div>
              </div>
              <div className="flex flex-1 overflow-hidden">{children}</div>
              <Toaster />
            </HydrateClient>
          </div>
        </PageErrorBoundary>
      </TRPCReactProvider>
    </NuqsAdapter>
  );
}
