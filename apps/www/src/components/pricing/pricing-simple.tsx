import { ArrowUpRight, Check } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { getAllPlanPricing } from "@repo/console-billing/pricing";

export function PricingSimple() {
  const pricingPlans = getAllPlanPricing();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
      {pricingPlans.map((plan, _index) => (
        <div
          key={plan.plan}
          className="flex flex-col border border-border rounded-sm p-6 h-full"
        >
          <div className="space-y-1">
            <h3 className="text-md font-bold text-foreground">{plan.name}</h3>
            <p className="text-md text-muted-foreground">{plan.description}</p>
          </div>

          <div className="space-y-3 mt-6 flex-1">
            {plan.features.map((feature, featureIndex) => (
              <div key={featureIndex} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                <span className="text-xs text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">
                  ${plan.price}
                </span>
                <span className="text-muted-foreground">/ {plan.interval}</span>
              </div>

              <div className="flex justify-start">
                <Button variant="default" className="rounded-full">
                  {plan.buttonText}
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
