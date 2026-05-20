import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import { Building2, Check, CreditCard, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";

import type { BillingPlan } from "./billing-utils";
import { businessContact, planAmountLabel } from "./billing-utils";

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
      <DialogContent
        className="fixed inset-0 top-0 left-0 z-50 h-dvh max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-6 shadow-none sm:max-w-none md:p-10"
        showCloseButton={false}
      >
        <div
          className={cn("mx-auto w-full max-w-7xl", isConfirming && "blur-sm")}
        >
          <div className="relative flex min-h-[calc(100dvh-5rem)] flex-col">
            <DialogHeader className="items-center gap-6 text-center">
              <DialogTitle className="font-medium text-3xl">
                Choose your plan
              </DialogTitle>
              <DialogDescription className="sr-only">
                Compare organization plans and choose a billing plan.
              </DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button
                aria-label="Close plan chooser"
                className="absolute top-0 right-0 size-11 rounded-xl"
                size="icon"
                variant="outline"
              >
                <X className="size-5" />
              </Button>
            </DialogClose>

            <div className="mt-10 grid flex-1 gap-6 lg:grid-cols-3">
              <PlanChoiceCard
                amountLabel={starterAmount}
                buttonLabel={
                  currentTier === "starter"
                    ? "Your current plan"
                    : isStarterSelectionDisabled
                      ? "Scheduled"
                    : "Switch to Starter"
                }
                description="A free organization workspace for getting started."
                features={[
                  "3 seats included",
                  "Free organization workspace",
                  "Basic access",
                ]}
                icon={<Sparkles className="size-5" />}
                isDisabled={
                  currentTier === "starter" || isStarterSelectionDisabled
                }
                onSelect={onSelectStarter}
                title="Starter"
              />
              <PlanChoiceCard
                amountLabel={teamAmount}
                buttonLabel={
                  currentTier === "team"
                    ? "Your current plan"
                    : "Switch to Team"
                }
                description="More usage and collaboration for active teams."
                features={[
                  "3 seats included",
                  "Priority product limits",
                  "Email support",
                  "Team workspace billing",
                ]}
                icon={<CreditCard className="size-5" />}
                isDisabled={currentTier === "team"}
                onSelect={onSelectTeam}
                title="Team"
              />
              <PlanChoiceCard
                amountLabel="Custom"
                buttonLabel={businessContact.label}
                description="Sales-led onboarding for larger teams."
                features={[
                  "SSO/SAML",
                  "Priority API access",
                  "Dedicated support",
                ]}
                icon={<Building2 className="size-5" />}
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
  amountLabel,
  buttonLabel,
  description,
  features,
  icon,
  isDisabled,
  onSelect,
  title,
}: {
  amountLabel: string;
  buttonLabel: string;
  description: string;
  features: string[];
  icon: ReactNode;
  isDisabled: boolean;
  onSelect: () => void;
  title: string;
}) {
  return (
    <div className="flex min-h-[520px] flex-col rounded-xl border bg-card px-7 py-8 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold text-2xl">{title}</h3>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-14 font-semibold text-5xl">{amountLabel}</p>
      <p className="mt-6 font-medium text-lg">{description}</p>
      <Button
        className="mt-8 w-full rounded-full"
        disabled={isDisabled}
        onClick={onSelect}
        variant={isDisabled ? "secondary" : "default"}
      >
        {buttonLabel}
      </Button>
      <div className="mt-8 space-y-5 text-muted-foreground text-sm">
        {features.map((feature) => (
          <div className="flex items-center gap-3" key={feature}>
            <Check className="size-4" />
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
