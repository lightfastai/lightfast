import {
  getCurrentSubscriptionItem,
  getDefaultPaymentMethod,
  getStarterPlan,
  getTeamPlan,
  tierForPlan,
} from "@repo/app-billing";
import type { BillingPaymentMethodResource } from "@vendor/clerk";
import type { BillingOverview } from "./billing-queries";

export type {
  BillingOverview,
  BillingSubscriptionItem,
} from "./billing-queries";

export function deriveBillingViewModel({
  overview,
  paymentMethods,
}: {
  overview: BillingOverview;
  paymentMethods: BillingPaymentMethodResource[];
}) {
  const { plans, subscription } = overview;
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

  return {
    cancelableTeamItem,
    canceledTeamItem,
    currentAmount,
    currentItem,
    currentPlan,
    currentPlanName,
    currentTier,
    defaultPaymentMethod,
    plans,
    starterPlan,
    subscription,
    teamPlan,
  };
}
