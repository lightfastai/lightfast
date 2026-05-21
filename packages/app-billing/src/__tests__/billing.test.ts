import {
  businessContact,
  cardLabel,
  checkoutErrorMessage,
  getCurrentSubscriptionItem,
  getDefaultPaymentMethod,
  getStarterPlan,
  getTeamPlan,
  paymentErrorMessage,
  planAmountLabel,
  statementStatusLabel,
  statusLabel,
  tierForPlan,
} from "@repo/app-billing";
import type { BillingPlan, BillingSubscription } from "@vendor/clerk/server";
import { describe, expect, it } from "vitest";

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

function subscription(): BillingSubscription {
  return {
    activeAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    eligibleForFreeTrial: false,
    id: "sub_org_acme",
    nextPayment: null,
    pastDueAt: null,
    payerId: "org_acme",
    status: "active",
    subscriptionItems: [
      {
        amount: undefined,
        canceledAt: null,
        createdAt: 1_700_000_000_000,
        endedAt: null,
        id: "sub_item_free",
        isFreeTrial: false,
        lifetimePaid: undefined,
        nextPayment: null,
        pastDueAt: null,
        payerId: "org_acme",
        periodEnd: 1_700_086_400_000,
        periodStart: 1_700_000_000_000,
        plan: starterPlan,
        planId: "cplan_free",
        planPeriod: "month",
        status: "active",
        updatedAt: 1_700_000_001_000,
      },
      {
        amount: teamAmount,
        canceledAt: null,
        createdAt: 1_700_000_000_000,
        endedAt: null,
        id: "sub_item_team",
        isFreeTrial: false,
        lifetimePaid: teamAmount,
        nextPayment: null,
        pastDueAt: null,
        payerId: "org_acme",
        periodEnd: 1_700_086_400_000,
        periodStart: 1_700_000_000_000,
        plan: teamPlan,
        planId: "cplan_team",
        planPeriod: "month",
        status: "past_due",
        updatedAt: 1_700_000_001_000,
      },
    ],
    updatedAt: 1_700_000_001_000,
  };
}

describe("billing plan helpers", () => {
  it("keeps the public package surface free of DTO schemas and mappers", async () => {
    const billing = await import("@repo/app-billing");

    expect(billing).not.toHaveProperty("billingOverviewSchema");
    expect(billing).not.toHaveProperty("billingPlanSchema");
    expect(billing).not.toHaveProperty("cancelSubscriptionItemInputSchema");
  });

  it("maps Clerk plan slugs and defaults to Lightfast tiers", () => {
    expect(tierForPlan(teamPlan)).toBe("team");
    expect(tierForPlan(starterPlan)).toBe("starter");
    expect(tierForPlan({ isDefault: false, slug: "enterprise" })).toBeNull();
    expect(tierForPlan(null)).toBeNull();
  });

  it("finds starter, team, and current paid subscription items", () => {
    const plans = [starterPlan, teamPlan];

    expect(getStarterPlan(plans)?.id).toBe("cplan_free");
    expect(getTeamPlan(plans)?.id).toBe("cplan_team");
    expect(getCurrentSubscriptionItem(subscription())?.id).toBe(
      "sub_item_team"
    );
  });
});

describe("billing display helpers", () => {
  it("formats money, statuses, cards, and sales contact copy", () => {
    expect(planAmountLabel(teamPlan)).toBe("$60.00/month");
    expect(planAmountLabel(starterPlan)).toBe("Free");
    expect(statusLabel("past_due")).toBe("past due");
    expect(statementStatusLabel("closed")).toBe("Paid");
    expect(cardLabel({ cardType: "visa", last4: "4242" })).toBe(
      "Visa •••• 4242"
    );
    expect(
      getDefaultPaymentMethod([{ id: "pm_1" }, { id: "pm_2", isDefault: true }])
        ?.id
    ).toBe("pm_2");
    expect(businessContact.href).toBe("mailto:sales@lightfast.ai");
  });

  it("extracts Clerk checkout and payment errors with stable fallbacks", () => {
    expect(
      checkoutErrorMessage({
        error: { message: "Card declined" },
        longMessage: "The card was declined",
      })
    ).toBe("The card was declined");
    expect(checkoutErrorMessage(null)).toBe("Checkout failed");
    expect(paymentErrorMessage({ error: { code: "expired_card" } })).toBe(
      "expired_card"
    );
    expect(paymentErrorMessage(null)).toBe(
      "Payment method could not be updated"
    );
  });
});
