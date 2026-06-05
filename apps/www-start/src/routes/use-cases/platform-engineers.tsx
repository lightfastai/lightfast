import { createFileRoute } from "@tanstack/react-router";
import PlatformEngineersPage from "~/app/(app)/(marketing)/(content)/use-cases/platform-engineers/page";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildUseCaseHead } from "~/lib/use-cases-content";

export const Route = createFileRoute("/use-cases/platform-engineers")({
  head: () => buildUseCaseHead("platform-engineers"),
  component: PlatformEngineersRoute,
});

function PlatformEngineersRoute() {
  return (
    <MarketingLayout>
      <PlatformEngineersPage />
    </MarketingLayout>
  );
}
