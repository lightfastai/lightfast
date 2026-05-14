import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  prefetch(trpc.pendingAllowed.account.get.queryOptions());

  return (
    <HydrateClient>
      <div className="relative flex flex-1 flex-col bg-background">
        <Suspense fallback={<div className="h-14" />}>
          <UserPageHeader />
        </Suspense>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </HydrateClient>
  );
}
