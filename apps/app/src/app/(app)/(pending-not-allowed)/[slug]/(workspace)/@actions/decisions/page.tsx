import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { DecisionsViewSwitcher } from "../../decisions/_components/decisions-view-switcher";

// Per-user, org-scoped data — never statically rendered.
export const dynamic = "force-dynamic";

export default function DecisionsActionsSlot() {
  prefetch({
    ...trpc.org.workspace.decisions.views.list.queryOptions(),
    staleTime: 60_000,
  });

  return (
    <HydrateClient>
      <DecisionsViewSwitcher />
    </HydrateClient>
  );
}
