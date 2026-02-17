import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { TRPCReactProvider } from "@repo/console-trpc/react";
import { prefetch, HydrateClient, userTrpc } from "@repo/console-trpc/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { env } from "~/env";
import { authUrl } from "~/lib/related-projects";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(userTrpc.organization.listUserOrganizations.queryOptions());

  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={`${authUrl}/sign-in`}
      signUpUrl={`${authUrl}/sign-up`}
      signInFallbackRedirectUrl="/account/teams/new"
      signUpFallbackRedirectUrl="/account/teams/new"
      taskUrls={{
        "choose-organization": "/account/teams/new",
      }}
    >
      <NuqsAdapter>
        <TRPCReactProvider>
          <PageErrorBoundary fallbackTitle="Failed to load application">
            <div className="dark h-screen flex flex-col overflow-hidden">
              <HydrateClient>
                <ConsoleNotificationsProvider>
                  <div className="flex-1 flex overflow-hidden">{children}</div>
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
