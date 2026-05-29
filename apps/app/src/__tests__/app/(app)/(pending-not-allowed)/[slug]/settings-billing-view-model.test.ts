import { describe, expect, it } from "vitest";

import {
  type BillingOverview,
  deriveBillingViewModel,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-view-model";

const teamAmount = {
  amount: 6000,
  amountFormatted: "60.00",
  currency: "usd",
  currencySymbol: "$",
};

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
};

const teamPlan = {
  ...starterPlan,
  description: "Team plan",
  fee: teamAmount,
  hasBaseFee: true,
  id: "cplan_team",
  isDefault: false,
  name: "Team",
  slug: "team",
};

const teamItem = {
  amount: teamAmount,
  canceledAt: null,
  createdAt: new Date("2026-05-01T00:00:00Z"),
  id: "sub_item_team",
  isFreeTrial: false,
  nextPayment: null,
  pastDueAt: null,
  periodEnd: new Date("2026-06-01T00:00:00Z"),
  periodStart: new Date("2026-05-01T00:00:00Z"),
  plan: teamPlan,
  planId: "cplan_team",
  planPeriod: "month",
  status: "active",
};

describe("billing view model", () => {
  it("derives plan and cancellation state from the billing overview", () => {
    expect(
      deriveBillingViewModel({
        overview: {
          plans: [starterPlan, teamPlan],
          subscription: {
            activeAt: new Date("2026-05-01T00:00:00Z"),
            createdAt: new Date("2026-05-01T00:00:00Z"),
            eligibleForFreeTrial: false,
            id: "sub_org_acme",
            nextPayment: null,
            pastDueAt: null,
            status: "active",
            subscriptionItems: [teamItem],
            updatedAt: new Date("2026-05-01T00:00:01Z"),
          },
        } as unknown as BillingOverview,
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
