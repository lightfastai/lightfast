import { createFileRoute } from "@tanstack/react-router";
import TechnicalFoundersPage from "~/app/(app)/(marketing)/(content)/use-cases/technical-founders/page";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
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
