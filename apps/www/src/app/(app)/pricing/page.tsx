import { PricingHero } from "~/components/pricing/pricing-hero";
import { PricingCards } from "~/components/pricing/pricing-cards";
import { PricingComparison } from "~/components/pricing/pricing-comparison";
import { PricingFAQ } from "~/components/pricing/pricing-faq";

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <PricingHero />
      <PricingCards />
      <PricingComparison />
      <PricingFAQ />
    </div>
  );
}