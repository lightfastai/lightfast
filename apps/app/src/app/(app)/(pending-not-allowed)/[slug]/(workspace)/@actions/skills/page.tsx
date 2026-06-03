import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SkillsActions } from "../../skills/_components/skills-actions";

// Per-org skill index — never statically rendered.
export const dynamic = "force-dynamic";

export default function SkillsActionsSlot() {
  // Prefetch into this slot's subtree so the freshness + repository actions
  // hydrate from the same cache the page uses, with no client fetch waterfall.
  prefetch(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );

  return (
    <HydrateClient>
      <SkillsActions />
    </HydrateClient>
  );
}
