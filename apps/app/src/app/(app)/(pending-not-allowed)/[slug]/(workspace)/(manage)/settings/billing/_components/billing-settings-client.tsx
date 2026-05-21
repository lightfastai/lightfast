"use client";

import type { AppRouterOutputs } from "@api/app";
import {
  getCurrentSubscriptionItem,
  getDefaultPaymentMethod,
  getStarterPlan,
  getTeamPlan,
  tierForPlan,
} from "@repo/app-billing";
import { useTRPC } from "@repo/app-trpc/react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { BillingStatementResource } from "@vendor/clerk";
import { useAuth, usePaymentMethods, useStatements } from "@vendor/clerk";
import { useCallback, useEffect, useState } from "react";

import { BillingCheckoutDialog } from "./billing-checkout-dialog";
import {
  CancellationSection,
  InvoicesSection,
  PaymentSection,
  PlanSection,
} from "./billing-sections";
import { PaymentMethodDialog } from "./payment-method-dialog";
import {
  ConfirmBusinessDialog,
  ConfirmDowngradeDialog,
  ConfirmUpgradeDialog,
} from "./plan-dialogs";
import { PlanSelectionDialog } from "./plan-selection-dialog";
import { StatementDetailsDialog } from "./statement-details-dialog";

type BillingOverview =
  AppRouterOutputs["org"]["settings"]["orgBilling"]["overview"];
type BillingPlan = BillingOverview["plans"][number];
type BillingSubscriptionItem =
  BillingOverview["subscription"]["subscriptionItems"][number];

const PRICING_HASH = "#pricing";

function pricingHashUrl() {
  return `${window.location.pathname}${window.location.search}${PRICING_HASH}`;
}

function billingUrlWithoutHash() {
  return `${window.location.pathname}${window.location.search}`;
}

export function BillingSettingsClient() {
  const trpc = useTRPC();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const overviewQueryOptions =
    trpc.org.settings.orgBilling.overview.queryOptions();
  const { data: overview } = useSuspenseQuery({
    ...overviewQueryOptions,
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

  const { plans, subscription } = overview;
  const isAdmin = auth.isLoaded && !!auth.has?.({ role: "org:admin" });
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
  const canceledTeamItem =
    currentItem &&
    tierForPlan(currentItem.plan) === "team" &&
    currentItem.canceledAt
      ? currentItem
      : null;

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [downgradeItem, setDowngradeItem] =
    useState<BillingSubscriptionItem | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<BillingPlan | null>(null);
  const [isBusinessConfirmOpen, setIsBusinessConfirmOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan | null>(null);
  const [selectedStatement, setSelectedStatement] =
    useState<BillingStatementResource | null>(null);

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

  const cancelMutation = useMutation(
    trpc.org.settings.orgBilling.cancelSubscriptionItem.mutationOptions({
      meta: { errorTitle: "Failed to schedule cancellation" },
      onMutate: async (input) => {
        await queryClient.cancelQueries({
          queryKey: overviewQueryOptions.queryKey,
        });

        const previousOverview = queryClient.getQueryData<BillingOverview>(
          overviewQueryOptions.queryKey
        );
        const canceledAt = Date.now();

        queryClient.setQueryData(
          overviewQueryOptions.queryKey,
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
          queryClient.setQueryData(
            overviewQueryOptions.queryKey,
            context.previousOverview
          );
        }
      },
      onSuccess: (updatedItem) => {
        queryClient.setQueryData(
          overviewQueryOptions.queryKey,
          (old: BillingOverview | undefined) =>
            old
              ? {
                  ...old,
                  subscription: {
                    ...old.subscription,
                    subscriptionItems: old.subscription.subscriptionItems.map(
                      (item) =>
                        item.id === updatedItem.id ? updatedItem : item
                    ),
                  },
                }
              : old
        );
      },
      onSettled: () =>
        void queryClient.invalidateQueries({
          queryKey: overviewQueryOptions.queryKey,
        }),
    })
  );

  function confirmDowngrade(item: BillingSubscriptionItem) {
    cancelMutation.mutate({
      subscriptionItemId: item.id,
    });
    setDowngradeItem(null);
    setPlanDialogOpen(false);
  }

  function confirmUpgrade(plan: BillingPlan) {
    setCheckoutPlan(plan);
    setUpgradePlan(null);
    setPlanDialogOpen(false);
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

      <div className="space-y-10">
        <PlanSection
          canceledAt={currentItem?.canceledAt ?? null}
          currentAmount={currentAmount}
          currentPlanName={currentPlanName}
          currentTier={currentTier}
          isAdmin={isAdmin}
          nextPayment={subscription?.nextPayment ?? null}
          onAdjustPlan={() => setPlanDialogOpen(true)}
          periodEnd={currentItem?.periodEnd ?? null}
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
          canceledAt={canceledTeamItem?.canceledAt ?? null}
          isAdmin={isAdmin}
          onCancelPlan={() => {
            if (cancelableTeamItem) {
              setDowngradeItem(cancelableTeamItem);
            }
          }}
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
        orgId={auth.orgId ?? undefined}
      />

      {checkoutPlan && (
        <BillingCheckoutDialog
          onComplete={() => {
            setCheckoutPlan(null);
            void queryClient.invalidateQueries({
              queryKey: overviewQueryOptions.queryKey,
            });
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
