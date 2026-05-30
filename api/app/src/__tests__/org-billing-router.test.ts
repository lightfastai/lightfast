import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const authMock = vi.fn();
const cancelSubscriptionItemMock = vi.fn();
const getPlanListMock = vi.fn();
const getOrganizationBillingSubscriptionMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: vi.fn() }));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  toPlainClerkResource: structuredClone,
  clerkClient: () =>
    Promise.resolve({
      billing: {
        cancelSubscriptionItem: cancelSubscriptionItemMock,
        getPlanList: getPlanListMock,
        getOrganizationBillingSubscription:
          getOrganizationBillingSubscriptionMock,
      },
    }),
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
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};
const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
};
const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
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
    amount: teamPlan.fee,
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

const starterSubscriptionItem = {
  ...teamSubscriptionItem,
  amount: null,
  id: "sub_item_starter",
  lifetimePaid: null,
  plan: starterPlan,
  planId: "cplan_free",
};

class ClerkResourceFixture<T extends object> {
  constructor(fields: T) {
    Object.assign(this, fields);
  }
}

function clerkResource<T extends object>(fields: T): T {
  return new ClerkResourceFixture(fields) as T;
}

function adminAccess(overrides: { orgId?: string; userId?: string } = {}) {
  return {
    kind: "clerk-session" as const,
    userId: overrides.userId ?? "user_current",
    orgId: overrides.orgId ?? "org_acme",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: () => false,
  };
}

function caller(
  identity = activeIdentity,
  access?: ReturnType<typeof adminAccess> | ReturnType<typeof nonAdminAccess>
) {
  return createCaller({
    auth:
      access === undefined
        ? { identity, access: adminAccess() }
        : { identity, access },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  authMock.mockReset();
  cancelSubscriptionItemMock.mockReset();
  getPlanListMock.mockReset();
  getOrganizationBillingSubscriptionMock.mockReset();

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
    data: [starterPlan, teamPlan],
  });
});

describe("orgBillingRouter public surface", () => {
  it("exposes overview reads and the privileged cancellation mutation", () => {
    expect(orgBillingRouter).toHaveProperty("overview");
    expect(orgBillingRouter).toHaveProperty("cancelSubscriptionItem");
  });
});

describe("orgBilling.overview", () => {
  it("rejects overview reads when caller has no active organization", async () => {
    await expect(
      caller(pendingIdentity).orgBilling.overview()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getPlanListMock).not.toHaveBeenCalled();
    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
  });

  it("rejects overview reads when caller is unauthenticated", async () => {
    await expect(
      caller(unauthenticatedIdentity).orgBilling.overview()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getPlanListMock).not.toHaveBeenCalled();
    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
  });

  it("returns Clerk-native organization billing data for SSR", async () => {
    const result = await caller().orgBilling.overview();

    expect(result).toEqual({
      plans: [starterPlan, teamPlan],
      subscription: {
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
      },
    });
    expect(result).not.toHaveProperty("isAdmin");
    expect(result).not.toHaveProperty("orgId");

    expect(getPlanListMock).toHaveBeenCalledWith({
      limit: 100,
      payerType: "org",
    });
    expect(getOrganizationBillingSubscriptionMock).toHaveBeenCalledWith(
      "org_acme"
    );
  });

  it("does not derive client admin state in the overview response", async () => {
    const result = await caller(
      activeIdentity,
      nonAdminAccess()
    ).orgBilling.overview();

    expect(result).not.toHaveProperty("isAdmin");
    expect(result).not.toHaveProperty("orgId");
  });

  it("strips Clerk resource prototypes before SSR hydration", async () => {
    const classBackedTeamPlan = clerkResource(teamPlan);
    const classBackedSubscriptionItem = clerkResource({
      ...teamSubscriptionItem,
      plan: classBackedTeamPlan,
    });
    getPlanListMock.mockResolvedValue({
      data: [clerkResource(starterPlan), classBackedTeamPlan],
    });
    getOrganizationBillingSubscriptionMock.mockResolvedValue(
      clerkResource({
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
        subscriptionItems: [classBackedSubscriptionItem],
        updatedAt: 1_700_000_001_000,
      })
    );

    const result = await caller().orgBilling.overview();

    expect(Object.getPrototypeOf(result.plans[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.subscription)).toBe(Object.prototype);
    expect(
      Object.getPrototypeOf(result.subscription.subscriptionItems[0])
    ).toBe(Object.prototype);
    expect(
      Object.getPrototypeOf(result.subscription.subscriptionItems[0]?.plan)
    ).toBe(Object.prototype);
    expect(result.subscription.subscriptionItems[0]?.plan).toMatchObject({
      id: "cplan_team",
      slug: "team",
    });
  });
});

describe("orgBilling.cancelSubscriptionItem", () => {
  it("rejects cancellation when caller has no active organization", async () => {
    await expect(
      caller(pendingIdentity).orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("rejects cancellation when caller is unauthenticated", async () => {
    await expect(
      caller(unauthenticatedIdentity).orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("rejects direct cancellation attempts from non-admin members", async () => {
    await expect(
      caller(
        activeIdentity,
        nonAdminAccess()
      ).orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_team",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("rejects cancellation when Clerk active org differs from tRPC context", async () => {
    await expect(
      caller(
        activeIdentity,
        adminAccess({ orgId: "org_other" })
      ).orgBilling.cancelSubscriptionItem({
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

  it("refuses to cancel non-Team subscription items", async () => {
    getOrganizationBillingSubscriptionMock.mockResolvedValue({
      activeAt: 1_700_000_000_000,
      createdAt: 1_700_000_000_000,
      eligibleForFreeTrial: false,
      id: "sub_org_acme",
      nextPayment: null,
      pastDueAt: null,
      payerId: "org_acme",
      status: "active",
      subscriptionItems: [starterSubscriptionItem],
      updatedAt: 1_700_000_001_000,
    });

    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "sub_item_starter",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("schedules team cancellation at the end of the current period", async () => {
    cancelSubscriptionItemMock.mockResolvedValue(
      clerkResource({
        ...teamSubscriptionItem,
        canceledAt: 1_700_000_002_000,
      })
    );

    const result = await caller().orgBilling.cancelSubscriptionItem({
      subscriptionItemId: "sub_item_team",
    });

    expect(result).toMatchObject({
      canceledAt: 1_700_000_002_000,
      id: "sub_item_team",
      plan: { id: "cplan_team", slug: "team" },
    });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.plan)).toBe(Object.prototype);
    expect(cancelSubscriptionItemMock).toHaveBeenCalledWith("sub_item_team", {
      endNow: false,
    });
  });

  it("validates cancellation input inline", async () => {
    await expect(
      caller().orgBilling.cancelSubscriptionItem({
        subscriptionItemId: "",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });
});
