import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { PeopleViewSwitcher } from "../../people/_components/people-view-switcher";

// Per-user, org-scoped data — never statically rendered.
export const dynamic = "force-dynamic";

export default function PeopleActionsSlot() {
  // Prefetch into this slot's subtree so the views bar hydrates with data and
  // avoids a client-side fetch waterfall on first paint.
  prefetch({
    ...trpc.org.workspace.people.views.list.queryOptions(),
    staleTime: 60_000,
  });

  return (
    <HydrateClient>
      <PeopleViewSwitcher />
    </HydrateClient>
  );
}
