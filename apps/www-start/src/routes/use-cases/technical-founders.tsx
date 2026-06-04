import { createFileRoute } from "@tanstack/react-router";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import TechnicalFoundersPage from "~/app/(app)/(marketing)/(content)/use-cases/technical-founders/page";
import { buildUseCaseHead } from "~/lib/use-cases-content";

export const Route = createFileRoute("/use-cases/technical-founders")({
  head: () => buildUseCaseHead("technical-founders"),
  component: TechnicalFoundersRoute,
});

function TechnicalFoundersRoute() {
  return (
    <MarketingLayout>
      <TechnicalFoundersPage />
    </MarketingLayout>
  );
}
