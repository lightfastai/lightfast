import { createFileRoute } from "@tanstack/react-router";
import MarketingLayout from "~/app/(app)/(marketing)/layout";
import PricingPage from "~/app/(app)/(marketing)/(content)/pricing/page";
import { buildPricingHead } from "~/lib/pricing-content";

export const Route = createFileRoute("/pricing")({
  head: () => buildPricingHead(),
  component: PricingRoute,
});

function PricingRoute() {
  return (
    <MarketingLayout>
      <PricingPage />
    </MarketingLayout>
  );
}
