import { TRPCReactProvider } from "@repo/app-trpc/react";
import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Toaster } from "@repo/ui/components/ui/sonner";
import { ClerkProvider } from "@vendor/clerk/client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";
import { ConsoleNotificationsProvider } from "~/components/notifications-provider";
import { env } from "~/env";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(trpc.organization.listUserOrganizations.queryOptions());

  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/account/welcome"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/account/welcome"
      signUpUrl="/sign-up"
      taskUrls={{
        "choose-organization": "/account/teams/new",
      }}
      waitlistUrl="/early-access"
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
