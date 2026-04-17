import { HydrateClient, prefetch, trpc } from "@repo/app-trpc/server";
import { RealtimeProviderWrapper } from "@repo/app-upstash-realtime/client";
import { Suspense } from "react";
import { AskLightfast, AskLightfastSkeleton } from "~/components/ask-lightfast";
import { Mailbox, MailboxSkeleton } from "./_components/mailbox";

export default async function OrgHomePage() {
  // Prefetch both tabs for instant switching
  prefetch(
    trpc.entities.list.infiniteQueryOptions(
      { limit: 30 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    )
  );
  prefetch(
    trpc.events.list.infiniteQueryOptions(
      { limit: 30 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    )
  );

  return (
    <HydrateClient>
      <RealtimeProviderWrapper>
        <div className="flex h-full">
          <Suspense fallback={<MailboxSkeleton />}>
            <Mailbox />
          </Suspense>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<AskLightfastSkeleton />}>
              <div className="h-full w-full px-6">
                <AskLightfast />
              </div>
            </Suspense>
          </div>
        </div>
      </RealtimeProviderWrapper>
    </HydrateClient>
  );
}
