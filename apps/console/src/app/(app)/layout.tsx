import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { AuthenticatedHeader } from "~/components/authenticated-header";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { PageErrorBoundary } from "~/components/errors/page-error-boundary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(trpc.organization.listUserOrganizations.queryOptions());

  return (
    <HydrateClient>
      <PageErrorBoundary fallbackTitle="Failed to load application">
        <Suspense fallback={<AppLayoutSkeleton />}>
          <div className="dark">
            <AuthenticatedHeader />
            {children}
          </div>
        </Suspense>
      </PageErrorBoundary>
    </HydrateClient>
  );
}

function AppLayoutSkeleton() {
  return (
    <div className="dark min-h-screen">
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-32 w-96" />
      </div>
    </div>
  );
}
