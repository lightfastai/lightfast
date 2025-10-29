import { exposureTrial } from "~/lib/fonts";

export function PricingHero() {
  return (
    <div className="flex">
      <div className="space-y-4">
        <h1
          className={`text-4xl font-light tracking-[-0.7] text-foreground ${exposureTrial.className}`}
        >
          Pricing
        </h1>
        <p className="text-sm text-muted-foreground">
          Simple, transparent pricing for AI workflow automation.
        </p>
      </div>
    </div>
  );
}
