import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import {
  cancelOrgBillingSubscriptionItemCommand,
  getOrgBillingOverviewCommand,
  type OrgBillingCommandDeps,
} from "../domain/org-billing";

const cancelSubscriptionItemMock = vi.fn();
const getPlanListMock = vi.fn();
const getOrganizationBillingSubscriptionMock = vi.fn();
const toPlainClerkResourceMock = vi.fn((value: unknown) =>
  structuredClone(value)
);

const adminCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    orgRole: "admin",
    source: "web",
    userId: "user_current",
  },
};

const nonAdminCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    source: "web",
    userId: "user_current",
  },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_current",
  },
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

function toPlainClerkResource<T>(resource: T): T {
  return toPlainClerkResourceMock(resource) as T;
}

function subscriptionFixture(
  subscriptionItems: unknown[] = [teamSubscriptionItem]
) {
  return {
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
    subscriptionItems,
    updatedAt: 1_700_000_001_000,
  };
}

function createDeps() {
  return {
    billing: {
      cancelSubscriptionItem: cancelSubscriptionItemMock,
      getPlanList: getPlanListMock,
      getOrganizationBillingSubscription:
        getOrganizationBillingSubscriptionMock,
    },
    toPlainClerkResource,
  } satisfies OrgBillingCommandDeps;
}

let deps: ReturnType<typeof createDeps>;

beforeEach(() => {
  cancelSubscriptionItemMock.mockReset();
  getPlanListMock.mockReset();
  getOrganizationBillingSubscriptionMock.mockReset();
  toPlainClerkResourceMock.mockClear();
  deps = createDeps();

  getPlanListMock.mockResolvedValue({ data: [starterPlan, teamPlan] });
  getOrganizationBillingSubscriptionMock.mockResolvedValue(
    subscriptionFixture()
  );
});

describe("getOrgBillingOverviewCommand", () => {
  it("rejects overview reads when caller has no active organization", async () => {
    await expect(
      getOrgBillingOverviewCommand.run({ ctx: pendingCtx, deps, input: {} })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });

    expect(getPlanListMock).not.toHaveBeenCalled();
    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
  });

  it("returns plain Clerk organization billing data for the active organization", async () => {
    const result = await getOrgBillingOverviewCommand.run({
      ctx: adminCtx,
      deps,
      input: {},
    });

    expect(result).toEqual({
      plans: [starterPlan, teamPlan],
      subscription: subscriptionFixture(),
    });
    expect(getPlanListMock).toHaveBeenCalledWith({
      limit: 100,
      payerType: "org",
    });
    expect(getOrganizationBillingSubscriptionMock).toHaveBeenCalledWith(
      "org_acme"
    );
    expect(toPlainClerkResourceMock).toHaveBeenCalledWith([
      starterPlan,
      teamPlan,
    ]);
    expect(toPlainClerkResourceMock).toHaveBeenCalledWith(
      subscriptionFixture()
    );
  });

  it("strips Clerk resource prototypes before returning overview data", async () => {
    const classBackedTeamPlan = clerkResource(teamPlan);
    const classBackedSubscriptionItem = clerkResource({
      ...teamSubscriptionItem,
      plan: classBackedTeamPlan,
    });
    getPlanListMock.mockResolvedValue({
      data: [clerkResource(starterPlan), classBackedTeamPlan],
    });
    getOrganizationBillingSubscriptionMock.mockResolvedValue(
      clerkResource(subscriptionFixture([classBackedSubscriptionItem]))
    );

    const result = await getOrgBillingOverviewCommand.run({
      ctx: adminCtx,
      deps,
      input: {},
    });

    expect(Object.getPrototypeOf(result.plans[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.subscription)).toBe(Object.prototype);
    expect(
      Object.getPrototypeOf(result.subscription.subscriptionItems[0])
    ).toBe(Object.prototype);
    expect(
      Object.getPrototypeOf(result.subscription.subscriptionItems[0]?.plan)
    ).toBe(Object.prototype);
  });
});

describe("cancelOrgBillingSubscriptionItemCommand", () => {
  it("rejects cancellation when caller has no active organization", async () => {
    await expect(
      cancelOrgBillingSubscriptionItemCommand.run({
        ctx: pendingCtx,
        deps,
        input: { subscriptionItemId: "sub_item_team" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });

    expect(getOrganizationBillingSubscriptionMock).not.toHaveBeenCalled();
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("rejects direct cancellation attempts from non-admin members", async () => {
    await expect(
      cancelOrgBillingSubscriptionItemCommand.run({
        ctx: nonAdminCtx,
        deps,
        input: { subscriptionItemId: "sub_item_team" },
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_REQUIRED",
      kind: "authz",
    });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("refuses to cancel subscription items outside the active organization subscription", async () => {
    await expect(
      cancelOrgBillingSubscriptionItemCommand.run({
        ctx: adminCtx,
        deps,
        input: { subscriptionItemId: "sub_item_other" },
      })
    ).rejects.toMatchObject({
      kind: "authz",
      message: "Subscription item does not belong to this organization",
    });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("refuses to cancel non-Team subscription items", async () => {
    getOrganizationBillingSubscriptionMock.mockResolvedValue(
      subscriptionFixture([starterSubscriptionItem])
    );

    await expect(
      cancelOrgBillingSubscriptionItemCommand.run({
        ctx: adminCtx,
        deps,
        input: { subscriptionItemId: "sub_item_starter" },
      })
    ).rejects.toMatchObject({
      kind: "validation",
      message: "Only the Team plan can be canceled",
    });
    expect(cancelSubscriptionItemMock).not.toHaveBeenCalled();
  });

  it("schedules team cancellation at the end of the current period", async () => {
    cancelSubscriptionItemMock.mockResolvedValue(
      clerkResource({
        ...teamSubscriptionItem,
        canceledAt: 1_700_000_002_000,
      })
    );

    const result = await cancelOrgBillingSubscriptionItemCommand.run({
      ctx: adminCtx,
      deps,
      input: { subscriptionItemId: "sub_item_team" },
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
});
