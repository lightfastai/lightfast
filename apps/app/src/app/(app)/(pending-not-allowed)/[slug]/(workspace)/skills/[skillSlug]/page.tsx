import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";
import { getQueryClient, HydrateClient, trpc } from "~/trpc/server";
import { SkillDetail } from "../_components/skill-detail";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillSlug: string; slug: string }>;
}) {
  const { skillSlug } = await params;
  const queryOptions = trpc.org.workspace.skills.get.queryOptions(
    { slug: skillSlug },
    { staleTime: 0 }
  );

  try {
    await getQueryClient().fetchQuery(queryOptions);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <HydrateClient>
      <SkillDetail skillSlug={skillSlug} />
    </HydrateClient>
  );
}
