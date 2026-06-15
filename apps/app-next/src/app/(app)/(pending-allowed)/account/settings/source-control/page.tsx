import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export const dynamic = "force-dynamic";

import { AccountSourceControlClient } from "./_components/account-source-control-client";

export default function AccountSourceControlPage() {
  prefetch(trpc.viewer.githubAccount.status.queryOptions());

  return (
    <HydrateClient>
      <AccountSourceControlClient />
    </HydrateClient>
  );
}
