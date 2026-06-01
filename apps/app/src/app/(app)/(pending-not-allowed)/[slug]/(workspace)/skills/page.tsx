import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { SkillsClient } from "./_components/skills-client";
import { SkillsLoading } from "./_components/skills-loading";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  prefetch(trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 }));

  return (
    <HydrateClient>
      <Suspense fallback={<SkillsLoading />}>
        <SkillsClient />
      </Suspense>
    </HydrateClient>
  );
}
