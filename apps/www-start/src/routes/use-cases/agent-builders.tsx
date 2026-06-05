import { createFileRoute } from "@tanstack/react-router";
import AgentBuildersPage from "~/app/(app)/(marketing)/(content)/use-cases/agent-builders/page";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildUseCaseHead } from "~/lib/use-cases-content";

export const Route = createFileRoute("/use-cases/agent-builders")({
  head: () => buildUseCaseHead("agent-builders"),
  component: AgentBuildersRoute,
});

function AgentBuildersRoute() {
  return (
    <MarketingLayout>
      <AgentBuildersPage />
    </MarketingLayout>
  );
}
