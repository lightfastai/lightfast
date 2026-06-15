"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  BillingPaymentMethodResource,
  BillingStatementResource,
} from "@vendor/clerk";
import { useAuth, usePaymentMethods, useStatements } from "@vendor/clerk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTRPC } from "~/trpc/react";

import { useCancelSubscriptionItemMutation } from "./billing-cancellation-mutation";
import { BillingCheckoutDialog } from "./billing-checkout-dialog";
import { useBillingOverviewRefresh } from "./billing-overview-actions";
import {
  CancellationSection,
  InvoicesSection,
  PaymentSection,
  PlanSection,
} from "./billing-sections";
import {
  type BillingOverview,
  deriveBillingViewModel,
} from "./billing-view-model";
import { PaymentMethodDialog } from "./payment-method-dialog";
import {
  ConfirmBusinessDialog,
  ConfirmDowngradeDialog,
  ConfirmUpgradeDialog,
} from "./plan-dialogs";
import { PlanSelectionDialog } from "./plan-selection-dialog";
import { StatementDetailsDialog } from "./statement-details-dialog";

type BillingPlan = BillingOverview["plans"][number];
type BillingSubscriptionItem =
  BillingOverview["subscription"]["subscriptionItems"][number];

const PRICING_HASH = "#pricing";
const EMPTY_PAYMENT_METHODS: BillingPaymentMethodResource[] = [];
const EMPTY_STATEMENTS: BillingStatementResource[] = [];

function pricingHashUrl() {
  return `${window.location.pathname}${window.location.search}${PRICING_HASH}`;
}

function billingUrlWithoutHash() {
  return `${window.location.pathname}${window.location.search}`;
}

function usePricingHashDialogState() {
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);

  const setPlanDialogOpen = useCallback((open: boolean) => {
    setIsPlanDialogOpen(open);

    if (open) {
      if (window.location.hash !== PRICING_HASH) {
        window.history.pushState(null, "", pricingHashUrl());
      }
      return;
    }

    if (window.location.hash === PRICING_HASH) {
      window.history.replaceState(null, "", billingUrlWithoutHash());
    }
  }, []);

  useEffect(() => {
    function syncPlanDialogToHash() {
      setIsPlanDialogOpen(window.location.hash === PRICING_HASH);
    }

    syncPlanDialogToHash();
    window.addEventListener("hashchange", syncPlanDialogToHash);
    window.addEventListener("popstate", syncPlanDialogToHash);

    return () => {
      window.removeEventListener("hashchange", syncPlanDialogToHash);
      window.removeEventListener("popstate", syncPlanDialogToHash);
    };
  }, []);

  return [isPlanDialogOpen, setPlanDialogOpen] as const;
}

export function BillingSettingsClient() {
  const trpc = useTRPC();
  const auth = useAuth();
  const refreshBillingOverview = useBillingOverviewRefresh();
  const { data: overview } = useSuspenseQuery({
    ...trpc.org.settings.orgBilling.overview.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const paymentMethodsQuery = usePaymentMethods({
    for: "organization",
    pageSize: 20,
  });
  const statementsQuery = useStatements({
    for: "organization",
    pageSize: 10,
  });

  const isAdmin = auth.isLoaded && !!auth.has?.({ role: "org:admin" });
  const paymentMethods = paymentMethodsQuery.data ?? EMPTY_PAYMENT_METHODS;
  const statements = statementsQuery.data ?? EMPTY_STATEMENTS;
  const billingModel = useMemo(
    () => deriveBillingViewModel({ overview, paymentMethods }),
    [overview, paymentMethods]
  );
  const {
    cancelableTeamItem,
    canceledTeamItem,
    currentAmount,
    currentItem,
    currentPlanName,
    currentTier,
    defaultPaymentMethod,
    starterPlan,
    subscription,
    teamPlan,
  } = billingModel;

  const [isPlanDialogOpen, setPlanDialogOpen] = usePricingHashDialogState();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [downgradeItem, setDowngradeItem] =
    useState<BillingSubscriptionItem | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null);
  const [isBusinessConfirmOpen, setIsBusinessConfirmOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [selectedStatement, setSelectedStatement] =
    useState<BillingStatementResource | null>(null);

  const { mutate: cancelSubscriptionItem } =
    useCancelSubscriptionItemMutation();

  const confirmDowngrade = useCallback(
    (item: BillingSubscriptionItem) => {
      cancelSubscriptionItem({
        subscriptionItemId: item.id,
      });
      setDowngradeItem(null);
      setPlanDialogOpen(false);
    },
    [cancelSubscriptionItem, setPlanDialogOpen]
  );

  const confirmUpgrade = useCallback(
    (plan: BillingPlan) => {
      setCheckoutPlan(plan);
      setUpgradePlan(null);
      setPlanDialogOpen(false);
    },
    [setPlanDialogOpen]
  );

  const openPlanDialog = useCallback(
    () => setPlanDialogOpen(true),
    [setPlanDialogOpen]
  );
  const openPaymentDialog = useCallback(() => setIsPaymentDialogOpen(true), []);
  const selectBusiness = useCallback(() => setIsBusinessConfirmOpen(true), []);
  const selectStarter = useCallback(() => {
    if (cancelableTeamItem) {
      setDowngradeItem(cancelableTeamItem);
    }
  }, [cancelableTeamItem]);
  const selectTeam = useCallback(() => {
    if (teamPlan) {
      setUpgradePlan(teamPlan);
    }
  }, [teamPlan]);
  const closeDowngradeDialog = useCallback((open: boolean) => {
    if (!open) {
      setDowngradeItem(null);
    }
  }, []);
  const closeUpgradeDialog = useCallback((open: boolean) => {
    if (!open) {
      setUpgradePlan(null);
    }
  }, []);
  const handlePaymentUpdated = useCallback(
    () => void paymentMethodsQuery.revalidate(),
    [paymentMethodsQuery]
  );
  const completeCheckout = useCallback(() => {
    setCheckoutPlan(null);
    void refreshBillingOverview();
  }, [refreshBillingOverview]);
  const setCheckoutDialogOpen = useCallback((open: boolean) => {
    if (!open) {
      setCheckoutPlan(null);
    }
  }, []);
  const setStatementDialogOpen = useCallback((open: boolean) => {
    if (!open) {
      setSelectedStatement(null);
    }
  }, []);

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

      <div className="space-y-10">
        <PlanSection
          canceledAt={currentItem?.canceledAt ?? null}
          currentAmount={currentAmount}
          currentPlanName={currentPlanName}
          currentTier={currentTier}
          isAdmin={isAdmin}
          nextPayment={subscription?.nextPayment ?? null}
          onAdjustPlan={openPlanDialog}
          periodEnd={currentItem?.periodEnd ?? null}
          status={subscription?.status ?? "active"}
        />

        <PaymentSection
          defaultPaymentMethod={defaultPaymentMethod}
          isAdmin={isAdmin}
          isLoading={paymentMethodsQuery.isLoading}
          onUpdate={openPaymentDialog}
        />

        <InvoicesSection
          isLoading={statementsQuery.isLoading}
          onViewStatement={setSelectedStatement}
          statements={statements}
        />

        <CancellationSection
          canCancel={!!cancelableTeamItem}
          canceledAt={canceledTeamItem?.canceledAt ?? null}
          isAdmin={isAdmin}
          onCancelPlan={selectStarter}
          periodEnd={canceledTeamItem?.periodEnd ?? null}
        />
      </div>

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
        isConfirming={!!downgradeItem || !!upgradePlan || isBusinessConfirmOpen}
        isStarterSelectionDisabled={!!canceledTeamItem}
        onOpenChange={setPlanDialogOpen}
        onSelectBusiness={selectBusiness}
        onSelectStarter={selectStarter}
        onSelectTeam={selectTeam}
        open={isPlanDialogOpen}
        starterPlan={starterPlan}
        teamPlan={teamPlan}
      />

      <ConfirmDowngradeDialog
        currentPlanName={currentPlanName}
        item={downgradeItem}
        onConfirm={confirmDowngrade}
        onOpenChange={closeDowngradeDialog}
      />

      <ConfirmUpgradeDialog
        onConfirm={confirmUpgrade}
        onOpenChange={closeUpgradeDialog}
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
        onUpdated={handlePaymentUpdated}
        open={isPaymentDialogOpen}
        orgId={auth.orgId ?? undefined}
      />

      {checkoutPlan && (
        <BillingCheckoutDialog
          onComplete={completeCheckout}
          onOpenChange={setCheckoutDialogOpen}
          open={!!checkoutPlan}
          plan={checkoutPlan}
        />
      )}

      <StatementDetailsDialog
        onOpenChange={setStatementDialogOpen}
        statement={selectedStatement}
      />
    </div>
  );
}
