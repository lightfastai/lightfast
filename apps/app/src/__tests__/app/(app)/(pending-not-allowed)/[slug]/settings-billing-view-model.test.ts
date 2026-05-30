import { describe, expect, it } from "vitest";

import {
  type BillingOverview,
  deriveBillingViewModel,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-view-model";

type BillingPlan = BillingOverview["plans"][number];
type BillingAmount = NonNullable<BillingPlan["fee"]>;
type BillingSubscription = BillingOverview["subscription"];
type BillingSubscriptionItem = BillingSubscription["subscriptionItems"][number];

const teamAmount = {
  amount: 6000,
  amountFormatted: "60.00",
  currency: "usd",
  currencySymbol: "$",
} satisfies BillingAmount;

const starterPlan = {
  annualFee: null,
  annualMonthlyFee: null,
  avatarUrl: null,
  description: "Starter plan",
  fee: null,
  features: [],
  forPayerType: "org",
  freeTrialDays: null,
  freeTrialEnabled: false,
  hasBaseFee: false,
  id: "cplan_free",
  isDefault: true,
  isRecurring: true,
  name: "Starter",
  publiclyVisible: true,
  slug: "free_org",
} satisfies BillingPlan;

const teamPlan = {
  ...starterPlan,
  description: "Team plan",
  fee: teamAmount,
  hasBaseFee: true,
  id: "cplan_team",
  isDefault: false,
  name: "Team",
  slug: "team",
} satisfies BillingPlan;

const teamItem = {
  amount: teamAmount,
  canceledAt: null,
  createdAt: 1_777_593_600_000,
  endedAt: null,
  id: "sub_item_team",
  isFreeTrial: false,
  lifetimePaid: teamAmount,
  nextPayment: null,
  pastDueAt: null,
  payerId: "org_acme",
  periodEnd: 1_780_272_000_000,
  periodStart: 1_777_593_600_000,
  plan: teamPlan,
  planId: "cplan_team",
  planPeriod: "month",
  status: "active",
  updatedAt: 1_777_593_601_000,
} satisfies BillingSubscriptionItem;

describe("billing view model", () => {
  it("derives plan and cancellation state from the billing overview", () => {
    const overview = {
      plans: [starterPlan, teamPlan],
      subscription: {
        activeAt: 1_777_593_600_000,
        createdAt: 1_777_593_600_000,
        eligibleForFreeTrial: false,
        id: "sub_org_acme",
        nextPayment: null,
        pastDueAt: null,
        payerId: "org_acme",
        status: "active",
        subscriptionItems: [teamItem],
        updatedAt: 1_777_593_601_000,
      },
    } satisfies BillingOverview;

    expect(
      deriveBillingViewModel({
        overview,
        paymentMethods: [],
      })
    ).toMatchObject({
      cancelableTeamItem: teamItem,
      canceledTeamItem: null,
      currentAmount: teamAmount,
      currentItem: teamItem,
      currentPlanName: "Team",
      currentTier: "team",
      defaultPaymentMethod: null,
      starterPlan,
      teamPlan,
    });
  });
});
