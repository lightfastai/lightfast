import { cancelOrgBillingSubscriptionItem } from "@api/app/tanstack/org-billing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BillingPaymentMethodResource,
  BillingStatementResource,
} from "@vendor/clerk";
import { useAuth, usePaymentMethods, useStatements } from "@vendor/clerk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BillingCheckoutDialog } from "./billing-checkout-dialog";
import {
  billingOverviewQueryOptions,
  orgBillingQueryKeys,
} from "./billing-queries";
import {
  CancellationSection,
  InvoicesSection,
  LoadingLine,
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
interface CancelOrgBillingSubscriptionItemInput {
  subscriptionItemId: string;
}

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
  const auth = useAuth();
  const queryClient = useQueryClient();
  const overviewQueryKey = useMemo(
    () => orgBillingQueryKeys.overview(auth.orgId),
    [auth.orgId]
  );
  const refreshBillingOverview = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: overviewQueryKey,
      }),
    [overviewQueryKey, queryClient]
  );
  const {
    data: overview,
    error: overviewError,
    isPending: isOverviewPending,
  } = useQuery({
    ...billingOverviewQueryOptions({ orgId: auth.orgId }),
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
    () =>
      overview ? deriveBillingViewModel({ overview, paymentMethods }) : null,
    [overview, paymentMethods]
  );
  const cancelableTeamItem = billingModel?.cancelableTeamItem ?? null;
  const canceledTeamItem = billingModel?.canceledTeamItem ?? null;
  const currentAmount = billingModel?.currentAmount ?? null;
  const currentItem = billingModel?.currentItem ?? null;
  const currentPlanName = billingModel?.currentPlanName ?? "Starter";
  const currentTier = billingModel?.currentTier ?? null;
  const defaultPaymentMethod = billingModel?.defaultPaymentMethod ?? null;
  const starterPlan = billingModel?.starterPlan ?? null;
  const subscription = billingModel?.subscription ?? null;
  const teamPlan = billingModel?.teamPlan ?? null;

  const [isPlanDialogOpen, setPlanDialogOpen] = usePricingHashDialogState();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [downgradeItem, setDowngradeItem] =
    useState<BillingSubscriptionItem | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null);
  const [isBusinessConfirmOpen, setIsBusinessConfirmOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [selectedStatement, setSelectedStatement] =
    useState<BillingStatementResource | null>(null);

  const { mutate: cancelSubscriptionItem } = useMutation({
    meta: { errorTitle: "Failed to schedule cancellation" },
    mutationFn: (data: CancelOrgBillingSubscriptionItemInput) =>
      cancelOrgBillingSubscriptionItem({ data }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: overviewQueryKey });

      const previousOverview =
        queryClient.getQueryData<BillingOverview>(overviewQueryKey);
      const canceledAt = Date.now();

      queryClient.setQueryData(
        overviewQueryKey,
        (old: BillingOverview | undefined) =>
          old
            ? {
                ...old,
                subscription: {
                  ...old.subscription,
                  subscriptionItems: old.subscription.subscriptionItems.map(
                    (item) =>
                      item.id === input.subscriptionItemId
                        ? { ...item, canceledAt }
                        : item
                  ),
                },
              }
            : old
      );

      return { previousOverview };
    },
    onError: (_err, _input, context) => {
      if (context?.previousOverview) {
        queryClient.setQueryData(overviewQueryKey, context.previousOverview);
      }
    },
    onSuccess: (updatedItem: BillingSubscriptionItem) => {
      queryClient.setQueryData(
        overviewQueryKey,
        (old: BillingOverview | undefined) =>
          old
            ? {
                ...old,
                subscription: {
                  ...old.subscription,
                  subscriptionItems: old.subscription.subscriptionItems.map(
                    (item) => (item.id === updatedItem.id ? updatedItem : item)
                  ),
                },
              }
            : old
      );
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey }),
  });

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

  if (auth.isLoaded && !auth.orgId) {
    return (
      <div className="space-y-8">
        <BillingSettingsHeader />
        <div className="rounded-lg border border-border/60 px-4 py-4 text-muted-foreground text-sm">
          Select an organization to view billing settings.
        </div>
      </div>
    );
  }

  if (!auth.isLoaded || isOverviewPending) {
    return (
      <div className="space-y-8">
        <BillingSettingsHeader />
        <div className="space-y-6">
          <LoadingLine label="Loading billing plan" />
          <LoadingLine label="Loading payment method" />
          <LoadingLine label="Loading invoices" />
        </div>
      </div>
    );
  }

  if (overviewError || !billingModel) {
    return (
      <div className="space-y-8">
        <BillingSettingsHeader />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-destructive text-sm">
          {overviewError?.message ?? "Unable to load billing settings."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BillingSettingsHeader />

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

function BillingSettingsHeader() {
  return (
    <div>
      <h2 className="font-medium font-pp text-2xl text-foreground">Billing</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Manage plan, payment method, invoices, and cancellation for this
        organization.
      </p>
    </div>
  );
}
