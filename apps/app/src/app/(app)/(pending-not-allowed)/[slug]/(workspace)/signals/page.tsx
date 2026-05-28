import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SignalsClient } from "./_components/signals-client";
import { SignalsLoading } from "./_components/signals-loading";

export const dynamic = "force-dynamic";

export default function SignalsPage() {
  prefetch(trpc.org.workspace.signals.list.queryOptions({ limit: 50 }));

  return (
    <HydrateClient>
      <Suspense fallback={<SignalsLoading />}>
        <SignalsClient />
      </Suspense>
    </HydrateClient>
  );
}
