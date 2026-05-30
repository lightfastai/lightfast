import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SignalsClient } from "./_components/signals-client";
import { SignalsLoading } from "./_components/signals-loading";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./_components/signals-model";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  prefetch({
    ...trpc.org.workspace.signals.workingSet.queryOptions(),
    staleTime: 30_000,
  });
  prefetch(
    trpc.org.workspace.signals.list.queryOptions(
      {
        limit: PROCESSING_SIGNALS_LIMIT,
        statuses: [...signalProcessingStatuses],
      },
      {
        staleTime: 5_000,
      }
    )
  );

  return (
    <HydrateClient>
      <Suspense fallback={<SignalsLoading />}>
        <SignalsClient />
      </Suspense>
    </HydrateClient>
  );
}
