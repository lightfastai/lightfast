import { createFileRoute } from "@tanstack/react-router";
import { AutomationCreateForm } from "~/automations/automation-create-form";

export const Route = createFileRoute("/_authenticated/$slug/automations/new")({
  head: ({ params }) => ({
    meta: [{ title: `New automation - ${params.slug} - Lightfast` }],
  }),
  component: NewAutomationPage,
});

function NewAutomationPage() {
  const { slug } = Route.useParams();
  return <AutomationCreateForm slug={slug} />;
}
