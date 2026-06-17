import { businessContact, planAmountLabel } from "@repo/app-billing";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { Check } from "lucide-react";

import type { BillingPlan } from "./billing-queries";

export function PlanSelectionDialog({
  currentTier,
  isStarterSelectionDisabled = false,
  isConfirming,
  onOpenChange,
  onSelectBusiness,
  onSelectStarter,
  onSelectTeam,
  open,
  starterPlan,
  teamPlan,
}: {
  currentTier: "starter" | "team" | null;
  isStarterSelectionDisabled?: boolean;
  isConfirming: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBusiness: () => void;
  onSelectStarter: () => void;
  onSelectTeam: () => void;
  open: boolean;
  starterPlan: BillingPlan | null;
  teamPlan: BillingPlan | null;
}) {
  const starterAmount = starterPlan ? planAmountLabel(starterPlan) : "Free";
  const teamAmount = teamPlan ? planAmountLabel(teamPlan) : "$60.00/month";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="fixed inset-0 top-0 left-0 z-50 h-dvh max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-0 shadow-none sm:max-w-none">
        <div
          className={cn(
            "mx-auto w-full max-w-6xl px-4 py-10",
            isConfirming && "blur-sm"
          )}
        >
          <div className="relative">
            <DialogHeader className="items-center text-center">
              <DialogTitle className="font-medium text-3xl">
                Choose your plan
              </DialogTitle>
              <DialogDescription className="sr-only">
                Compare organization plans and choose a billing plan.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-10 grid w-full grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-3">
              <PlanChoiceCard
                amountLabel={starterAmount}
                buttonLabel={
                  currentTier === "starter"
                    ? "Your current plan"
                    : isStarterSelectionDisabled
                      ? "Scheduled"
                      : "Switch to Starter"
                }
                className="md:col-span-2 lg:col-span-1"
                description="Try Lightfast with your team"
                features={[
                  "Up to 3 users",
                  "2 sources included",
                  "2,500 searches/month total",
                  "14-day retention",
                  "Basic keyword search",
                  "REST API access",
                  "Community support",
                ]}
                isDisabled={
                  currentTier === "starter" || isStarterSelectionDisabled
                }
                onSelect={onSelectStarter}
                title="Starter"
              />
              <PlanChoiceCard
                addOns={[
                  "+$10 per additional source",
                  "+$5 per 1K extra searches",
                  "+$20/mo for 180-day retention",
                ]}
                amountLabel={teamAmount}
                buttonLabel={
                  currentTier === "team"
                    ? "Your current plan"
                    : "Switch to Team"
                }
                className="md:col-span-2 lg:col-span-1"
                description="Everything you need to scale"
                features={[
                  "1,500 searches per user/month",
                  "5 sources included",
                  "60-day retention",
                  "Semantic search (AI-powered)",
                  "Basic Decision Surfacing",
                  "Identity tracking (email-based)",
                  "API access (25K calls/day)",
                  "Email support",
                  "Minimum 3 users",
                ]}
                highlighted
                isDisabled={currentTier === "team"}
                onSelect={onSelectTeam}
                title="Team"
              />
              <PlanChoiceCard
                amountLabel="Custom"
                buttonLabel={businessContact.label}
                className="md:col-span-2 md:col-start-2 lg:col-span-1 lg:col-start-auto"
                description="Unlimited everything. Let's talk."
                features={[
                  "Unlimited searches",
                  "Unlimited sources",
                  "1-year retention (configurable)",
                  "Advanced Decision Surfacing",
                  "Auto-summaries (daily/weekly)",
                  "Actor expertise profiles",
                  "Full identity mapping (OAuth/SSO)",
                  "Temporal state tracking",
                  "Priority API access",
                  "SSO/SAML",
                  "SLA guarantees",
                  "Dedicated support",
                ]}
                isDisabled={false}
                onSelect={onSelectBusiness}
                title="Business"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanChoiceCard({
  addOns,
  amountLabel,
  buttonLabel,
  className,
  description,
  features,
  highlighted = false,
  isDisabled,
  onSelect,
  title,
}: {
  addOns?: string[];
  amountLabel: string;
  buttonLabel: string;
  className?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  isDisabled: boolean;
  onSelect: () => void;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-sm bg-card p-6 text-card-foreground",
        highlighted && "border border-foreground shadow-lg",
        className
      )}
    >
      <div className="space-y-1">
        <h3 className="font-bold text-base text-foreground">{title}</h3>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div className="flex items-start gap-3" key={feature}>
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
            <span className="text-foreground text-sm">{feature}</span>
          </div>
        ))}
        {addOns && (
          <div className="mt-3 border-border/50 border-t pt-3">
            <p className="mb-2 font-semibold text-foreground text-xs">
              Scale as needed:
            </p>
            {addOns.map((addOn) => (
              <div className="flex items-start gap-3" key={addOn}>
                <span className="text-muted-foreground text-sm">{addOn}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-12 space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-4xl text-foreground">
            {amountLabel}
          </span>
        </div>
        <div className="flex justify-start">
          <Button
            className="rounded-full"
            disabled={isDisabled}
            onClick={onSelect}
            variant={
              isDisabled ? "secondary" : highlighted ? "default" : "outline"
            }
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
