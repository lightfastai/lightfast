import { TRPCReactProvider } from "@repo/console-trpc/react";
import { HydrateClient, prefetch, userTrpc } from "@repo/console-trpc/server";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { ClerkProvider } from "@vendor/clerk/client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";
import { env } from "~/env";
import { authUrl } from "~/lib/related-projects";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(userTrpc.organization.listUserOrganizations.queryOptions());

  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/account/welcome"
      signInUrl={`${authUrl}/sign-in`}
      signUpFallbackRedirectUrl="/account/welcome"
      signUpUrl={`${authUrl}/sign-up`}
      taskUrls={{
        "choose-organization": "/account/teams/new",
      }}
    >
      <NuqsAdapter>
        <TRPCReactProvider>
          <PageErrorBoundary fallbackTitle="Failed to load application">
            <div className="dark flex h-screen flex-col overflow-hidden">
              <HydrateClient>
                <ConsoleNotificationsProvider>
                  <div className="flex flex-1 overflow-hidden">{children}</div>
                  <Toaster />
                </ConsoleNotificationsProvider>
              </HydrateClient>
            </div>
          </PageErrorBoundary>
        </TRPCReactProvider>
      </NuqsAdapter>
    </ClerkProvider>
  );
}
