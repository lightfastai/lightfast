import { HydrateClient, prefetch, userTrpc } from "@repo/console-trpc/server";
import { Suspense } from "react";
import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  prefetch(userTrpc.account.get.queryOptions());

  return (
    <HydrateClient>
      <div className="relative flex flex-1 flex-col bg-background">
        <Suspense fallback={<div className="h-14 border-border border-b" />}>
          <UserPageHeader />
        </Suspense>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </HydrateClient>
  );
}
