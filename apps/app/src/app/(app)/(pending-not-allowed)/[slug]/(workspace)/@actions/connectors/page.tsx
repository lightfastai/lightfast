import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { ConnectorsActions } from "../../connectors/_components/connectors-actions";

export const dynamic = "force-dynamic";

export default function ConnectorsActionsSlot() {
  prefetch({
    ...trpc.org.workspace.connectors.listSections.queryOptions(),
    staleTime: 30_000,
  });

  return (
    <HydrateClient>
      <ConnectorsActions />
    </HydrateClient>
  );
}
