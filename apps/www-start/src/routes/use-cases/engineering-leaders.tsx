import { createFileRoute } from "@tanstack/react-router";
import EngineeringLeadersPage from "~/app/(app)/(marketing)/(content)/use-cases/engineering-leaders/page";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildUseCaseHead } from "~/lib/use-cases-content";

export const Route = createFileRoute("/use-cases/engineering-leaders")({
  head: () => buildUseCaseHead("engineering-leaders"),
  component: EngineeringLeadersRoute,
});

function EngineeringLeadersRoute() {
  return (
    <MarketingLayout>
      <EngineeringLeadersPage />
    </MarketingLayout>
  );
}
