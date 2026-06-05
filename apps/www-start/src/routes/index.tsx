import { createFileRoute } from "@tanstack/react-router";
import HomePage from "~/app/(app)/(marketing)/(landing)/page";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import { buildLandingHead } from "~/lib/landing-content";

export const Route = createFileRoute("/")({
  head: () => buildLandingHead(),
  component: IndexRoute,
});

function IndexRoute() {
  return (
    <MarketingLayout>
      <HomePage />
    </MarketingLayout>
  );
}
