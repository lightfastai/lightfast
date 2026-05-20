"use client";

import type {
  BillingPlanResource,
  BillingStatementResource,
  BillingSubscriptionItemResource,
} from "@vendor/clerk/client/experimental";
import { useTRPC } from "@repo/app-trpc/react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk/client";
import {
  usePaymentMethods,
  usePlans,
  useStatements,
  useSubscription,
} from "@vendor/clerk/client/experimental";
import { useState } from "react";

import { BillingCheckoutDialog } from "./billing-checkout-dialog";
import {
  getCurrentSubscriptionItem,
  getDefaultPaymentMethod,
  getStarterPlan,
  getTeamPlan,
  tierForPlan,
} from "./billing-utils";
import { CancellationSection } from "./cancellation-section";
import { ConfirmBusinessDialog } from "./confirm-business-dialog";
import { ConfirmDowngradeDialog } from "./confirm-downgrade-dialog";
import { ConfirmUpgradeDialog } from "./confirm-upgrade-dialog";
import { InvoicesSection } from "./invoices-section";
import { LoadingLine } from "./loading-line";
import { PaymentMethodDialog } from "./payment-method-dialog";
import { PaymentSection } from "./payment-section";
import { PlanSection } from "./plan-section";
import { PlanSelectionDialog } from "./plan-selection-dialog";
import { StatementDetailsDialog } from "./statement-details-dialog";

export function BillingSettingsClient() {
  const { has, isLoaded, orgId } = useAuth();
  const isAdmin = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();

  const plansQuery = usePlans({
    for: "organization",
    pageSize: 100,
  });
  const subscriptionQuery = useSubscription({
    for: "organization",
  });
  const paymentMethodsQuery = usePaymentMethods({
    for: "organization",
    pageSize: 20,
  });
  const statementsQuery = useStatements({
    for: "organization",
    pageSize: 10,
  });

  const plans = plansQuery.data ?? [];
  const subscription = subscriptionQuery.data ?? null;
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const starterPlan = getStarterPlan(plans);
  const teamPlan = getTeamPlan(plans);
  const currentItem = getCurrentSubscriptionItem(subscription);
  const currentPlan = currentItem?.plan ?? starterPlan;
  const currentTier = tierForPlan(currentPlan) ?? "starter";
  const currentPlanName = currentPlan?.name ?? "Starter";
  const currentAmount = currentItem?.amount ?? currentPlan?.fee ?? null;
  const defaultPaymentMethod = getDefaultPaymentMethod(paymentMethods);
  const cancelableTeamItem =
    currentItem &&
    tierForPlan(currentItem.plan) === "team" &&
    !currentItem.canceledAt
      ? currentItem
      : null;

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [downgradeItem, setDowngradeItem] =
    useState<BillingSubscriptionItemResource | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlanResource | null>(
    null
  );
  const [isBusinessConfirmOpen, setIsBusinessConfirmOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlanResource | null>(
    null
  );
  const [selectedStatement, setSelectedStatement] =
    useState<BillingStatementResource | null>(null);

  const cancelMutation = useMutation(
    trpc.pendingNotAllowed.orgBilling.cancelSubscriptionItem.mutationOptions({
      meta: { errorTitle: "Failed to schedule cancellation" },
      onSettled: () => void subscriptionQuery.revalidate(),
    })
  );

  function confirmDowngrade(item: BillingSubscriptionItemResource) {
    cancelMutation.mutate({
      subscriptionItemId: item.id,
    });
    setDowngradeItem(null);
    setIsPlanDialogOpen(false);
  }

  function confirmUpgrade(plan: BillingPlanResource) {
    setCheckoutPlan(plan);
    setUpgradePlan(null);
    setIsPlanDialogOpen(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-medium font-pp text-2xl text-foreground">
          Billing
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage plan, payment method, invoices, and cancellation for this
          organization.
        </p>
      </div>

      {plansQuery.isLoading || subscriptionQuery.isLoading ? (
        <LoadingLine label="Loading billing" />
      ) : (
        <div className="space-y-10">
          <PlanSection
            currentAmount={currentAmount}
            currentPlanName={currentPlanName}
            currentTier={currentTier}
            isAdmin={isAdmin}
            nextPayment={subscription?.nextPayment ?? null}
            onAdjustPlan={() => setIsPlanDialogOpen(true)}
            status={subscription?.status ?? "active"}
          />

          <PaymentSection
            defaultPaymentMethod={defaultPaymentMethod}
            isAdmin={isAdmin}
            isLoading={paymentMethodsQuery.isLoading}
            onUpdate={() => setIsPaymentDialogOpen(true)}
          />

          <InvoicesSection
            isLoading={statementsQuery.isLoading}
            onViewStatement={setSelectedStatement}
            statements={statements}
          />

          <CancellationSection
            canCancel={!!cancelableTeamItem}
            isAdmin={isAdmin}
            onCancelPlan={() => {
              if (cancelableTeamItem) {
                setDowngradeItem(cancelableTeamItem);
              }
            }}
          />
        </div>
      )}

      {!isAdmin && (
        <div className="rounded-lg border border-border/60 px-4 py-4">
          <p className="font-medium text-sm">
            Billing is managed by organization admins.
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Ask an organization admin to make subscription or payment changes.
          </p>
        </div>
      )}

      <PlanSelectionDialog
        currentTier={currentTier}
        isConfirming={
          !!downgradeItem || !!upgradePlan || isBusinessConfirmOpen
        }
        onOpenChange={setIsPlanDialogOpen}
        onSelectBusiness={() => setIsBusinessConfirmOpen(true)}
        onSelectStarter={() => {
          if (cancelableTeamItem) {
            setDowngradeItem(cancelableTeamItem);
          }
        }}
        onSelectTeam={() => {
          if (teamPlan) {
            setUpgradePlan(teamPlan);
          }
        }}
        open={isPlanDialogOpen}
        starterPlan={starterPlan}
        teamPlan={teamPlan}
      />

      <ConfirmDowngradeDialog
        currentPlanName={currentPlanName}
        item={downgradeItem}
        onConfirm={confirmDowngrade}
        onOpenChange={(open) => {
          if (!open) {
            setDowngradeItem(null);
          }
        }}
      />

      <ConfirmUpgradeDialog
        onConfirm={confirmUpgrade}
        onOpenChange={(open) => {
          if (!open) {
            setUpgradePlan(null);
          }
        }}
        plan={upgradePlan}
      />

      <ConfirmBusinessDialog
        onOpenChange={setIsBusinessConfirmOpen}
        open={isBusinessConfirmOpen}
      />

      <PaymentMethodDialog
        defaultPaymentMethod={defaultPaymentMethod}
        isLoading={paymentMethodsQuery.isLoading}
        methods={paymentMethods}
        onOpenChange={setIsPaymentDialogOpen}
        onUpdated={() => void paymentMethodsQuery.revalidate()}
        open={isPaymentDialogOpen}
        orgId={orgId ?? undefined}
      />

      {checkoutPlan && (
        <BillingCheckoutDialog
          onComplete={() => {
            setCheckoutPlan(null);
            void subscriptionQuery.revalidate();
          }}
          onOpenChange={(open) => {
            if (!open) {
              setCheckoutPlan(null);
            }
          }}
          open={!!checkoutPlan}
          plan={checkoutPlan}
        />
      )}

      <StatementDetailsDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStatement(null);
          }
        }}
        statement={selectedStatement}
      />
    </div>
  );
}
