import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "~/components/workspace-page";

export const Route = createFileRoute("/_authenticated/$slug/skills")({
  head: ({ params }) => ({
    meta: [{ title: `Skills - ${params.slug} - Lightfast` }],
  }),
  component: SkillsPage,
});

function SkillsPage() {
  const { slug } = Route.useParams();
  return (
    <WorkspacePage
      description="Skill routes are mounted in the TanStack workspace shell. The skills list and detail flows can be migrated behind this page."
      eyebrow={`/${slug}/skills`}
      title="Skills"
    />
  );
}
