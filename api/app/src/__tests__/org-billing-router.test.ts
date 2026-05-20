import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const authMock = vi.fn();
const cancelSubscriptionItemMock = vi.fn();
const getOrganizationBillingSubscriptionMock = vi.fn();
const getPlanListMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: vi.fn() }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      billing: {
        cancelSubscriptionItem: cancelSubscriptionItemMock,
        getOrganizationBillingSubscription:
          getOrganizationBillingSubscriptionMock,
        getPlanList: getPlanListMock,
      },
    }),
  verifyToken: vi.fn(),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { orgBillingRouter } = await import(
  "../router/(pending-not-allowed)/org-billing"
);

const testRouter = createTRPCRouter({
  orgBilling: orgBillingRouter,
});
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound" },
};

const teamPlan = {
  annualFee: null,
  annualMonthlyFee: null,
  avatarUrl: null,
  description: "Team plan",
  fee: {
    amount: 6000,
    amountFormatted: "60.00",
    currency: "usd",
    currencySymbol: "$",
  },
  features: [],
  forPayerType: "org",
  freeTrialDays: null,
  freeTrialEnabled: false,
  hasBaseFee: true,
  id: "cplan_team",
  isDefault: false,
  isRecurring: true,
  name: "Team",
  publiclyVisible: true,
  slug: "team",
};

const starterPlan = {
  ...teamPlan,
  description: "Starter plan",
  fee: null,
  hasBaseFee: false,
  id: "cplan_free",
  isDefault: true,
  name: "Starter",
  slug: "free_org",
};

const teamSubscriptionItem = {
  amount: teamPlan.fee,
  canceledAt: null,
  createdAt: 1_700_000_000_000,
  endedAt: null,
  id: "sub_item_team",
  isFreeTrial: false,
  lifetimePaid: teamPlan.fee,
  nextPayment: {
    amount: 6000,
    date: 1_700_086_400_000,
  },
  pastDueAt: null,
  payerId: "org_acme",
  periodEnd: 1_700_086_400_000,
  periodStart: 1_700_000_000_000,
  plan: teamPlan,
  planId: "cplan_team",
  planPeriod: "month",
  status: "active",
  updatedAt: 1_700_000_001_000,
};

function caller(identity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  authMock.mockReset();
  cancelSubscriptionItemMock.mockReset();
  getOrganizationBillingSubscriptionMock.mockReset();
  getPlanListMock.mockReset();

  authMock.mockResolvedValue({
    has: () => true,
    orgId: "org_acme",
    userId: "user_current",
  });

  getOrganizationBillingSubscriptionMock.mockResolvedValue({
    activeAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    eligibleForFreeTrial: false,
    id: "sub_org_acme",
    nextPayment: {
      amount: teamPlan.fee,
      date: 1_700_086_400_000,
    },
    pastDueAt: null,
    payerId: "org_acme",
    status: "active",
    subscriptionItems: [teamSubscriptionItem],
    updatedAt: 1_700_000_001_000,
  });
  getPlanListMock.mockResolvedValue({
    data: [
      starterPlan,
      teamPlan,
      { ...teamPlan, id: "cplan_business", slug: "business" },
    ],
    totalCount: 3,
  });
});

describe("orgBilling.overview", () => {
  it("returns organization subscription and starter/team plans from Clerk", async () => {
    await expect(caller().orgBilling.overview()).resolves.toMatchObject({
      businessContact: {
        email: "sales@lightfast.ai",
        href: "mailto:sales@lightfast.ai",
        label: "Contact Sales",
      },
      plans: [
        {
          id: "cplan_free",
          name: "Starter",
          slug: "free_org",
          tier: "starter",
        },
        {
          amount: {
            amount: 6000,
            amountFormatted: "60.00",
            currency: "usd",
            currencySymbol: "$",
          },
          id: "cplan_team",
          name: "Team",
          slug: "team",
          tier: "team",
        },
      ],
      subscription: {
        currentItem: {
          id: "sub_item_team",
          plan: { id: "cplan_team", name: "Team", slug: "team", tier: "team" },
          status: "active",
        },
        id: "sub_org_acme",
        payerId: "org_acme",
        status: "active",
        upcomingItem: null,
      },
    });

    expect(getOrganizationBillingSubscriptionMock).toHaveBeenCalledWith(
      "org_acme"
    );
    expect(getPlanListMock).toHaveBeenCalledWith({
      limit: 100,
      offset: 0,
      payerType: "org",
    });
  });
});

describe("orgBilling.cancelSubscriptionItem", () => {
  it("rejects direct cancellation attempts from non-admin members", async () => {
    authMock.mockResolvedValue({
      has: ({ role }: { role?: string }) => role !== "org:admin",
      orgId: "org_acme",
      userId: "user_current",
    });

    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("rejects cancellation when Clerk active org differs from tRPC context", async () => {
    authMock.mockResolvedValue({
      has: ({ role }: { role?: string }) => role === "org:admin",
      orgId: "org_other",
      userId: "user_current",
    });

    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("refuses to cancel subscription items outside the active organization subscription", async () => {
    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_other",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("schedules team cancellation at the end of the current period", async () => {
    cancelSubscriptionItemMock.mockResolvedValue({
      ...teamSubscriptionItem,
      canceledAt: 1_700_000_002_000,
    });

    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).resolves.toEqual({ success: true });
    expect(cancelSubscriptionItemMock).toHaveBeenCalledWith("sub_item_team", {
      endNow: false,
    });
  });
});
