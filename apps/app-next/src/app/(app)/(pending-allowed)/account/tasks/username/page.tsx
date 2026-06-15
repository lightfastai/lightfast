import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { UsernameAccountTaskClient } from "./_components/username-account-task-client";

export const dynamic = "force-dynamic";

interface UsernameAccountTaskPageProps {
  searchParams: Promise<{ return_to?: string | string[] }>;
}

export default async function UsernameAccountTaskPage({
  searchParams,
}: UsernameAccountTaskPageProps) {
  const { return_to: returnToParam } = await searchParams;

  prefetch(trpc.viewer.account.get.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={null}>
        <UsernameAccountTaskClient
          returnTo={
            Array.isArray(returnToParam) ? returnToParam[0] : returnToParam
          }
        />
      </Suspense>
    </HydrateClient>
  );
}
