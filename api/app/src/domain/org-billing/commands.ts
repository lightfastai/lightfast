import { z } from "zod";

import { defineCommand } from "../command";
import { AuthzError, ValidationError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

export interface OrgBillingMoneyAmount {
  amount: number;
  amountFormatted: string;
  currency: string;
  currencySymbol: string;
}

export interface OrgBillingPlan {
  annualFee?: OrgBillingMoneyAmount | null;
  annualMonthlyFee?: OrgBillingMoneyAmount | null;
  avatarUrl?: string | null;
  description?: string | null;
  fee?: OrgBillingMoneyAmount | null;
  forPayerType?: string;
  freeTrialDays?: number | null;
  freeTrialEnabled?: boolean;
  hasBaseFee?: boolean;
  id: string;
  isDefault: boolean;
  isRecurring?: boolean;
  name: string;
  publiclyVisible?: boolean;
  slug: string;
}

export interface OrgBillingNextPayment {
  amount: OrgBillingMoneyAmount | null;
  date: Date | number | null;
}

export interface OrgBillingSubscriptionItem {
  amount?: OrgBillingMoneyAmount | null;
  canceledAt?: Date | number | null;
  createdAt?: Date | number | null;
  endedAt?: Date | number | null;
  id: string;
  isFreeTrial?: boolean;
  lifetimePaid?: OrgBillingMoneyAmount | null;
  nextPayment?: OrgBillingNextPayment | null;
  pastDueAt?: Date | number | null;
  payerId?: string;
  periodEnd?: Date | number | null;
  periodStart?: Date | number | null;
  plan?: OrgBillingPlan | null;
  planId?: string;
  planPeriod?: string;
  status: string;
  updatedAt?: Date | number | null;
}

export interface OrgBillingSubscription {
  activeAt?: Date | number | null;
  createdAt?: Date | number | null;
  eligibleForFreeTrial?: boolean;
  id: string;
  nextPayment?: OrgBillingNextPayment | null;
  pastDueAt?: Date | number | null;
  payerId?: string;
  status: string;
  subscriptionItems: OrgBillingSubscriptionItem[];
  updatedAt?: Date | number | null;
}

interface ClerkBillingSubscription {
  subscriptionItems: Array<{
    id: string;
    plan?: { slug?: string | null } | null;
  }>;
}

interface ClerkBillingClient {
  cancelSubscriptionItem(
    subscriptionItemId: string,
    input: { endNow: boolean }
  ): Promise<unknown>;
  getOrganizationBillingSubscription(
    orgId: string
  ): Promise<ClerkBillingSubscription>;
  getPlanList(input: {
    limit: number;
    payerType: "org";
  }): Promise<{ data: unknown[] }>;
}

export interface OrgBillingCommandDeps {
  billing: ClerkBillingClient;
  toPlainClerkResource: <T>(resource: T) => T;
}

const billingPlanOutput = z.custom<OrgBillingPlan>(
  (value) => typeof value === "object" && value !== null
);
const billingSubscriptionOutput = z.custom<OrgBillingSubscription>(
  (value) => typeof value === "object" && value !== null
);
const billingSubscriptionItemOutput = z.custom<OrgBillingSubscriptionItem>(
  (value) => typeof value === "object" && value !== null
);

const getOrgBillingOverviewInput = z.object({}).strict();
const getOrgBillingOverviewOutput = z.object({
  plans: z.array(billingPlanOutput),
  subscription: billingSubscriptionOutput,
});
const cancelOrgBillingSubscriptionItemInput = z.object({
  subscriptionItemId: z.string().min(1),
});

export type OrgBillingOverviewResult = z.infer<
  typeof getOrgBillingOverviewOutput
>;
export type OrgBillingSubscriptionItemResult = z.infer<
  typeof billingSubscriptionItemOutput
>;

export const getOrgBillingOverviewCommand = defineCommand<
  "orgBilling.overview",
  typeof getOrgBillingOverviewInput,
  typeof getOrgBillingOverviewOutput,
  OrgBillingCommandDeps
>({
  name: "orgBilling.overview",
  input: getOrgBillingOverviewInput,
  output: getOrgBillingOverviewOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const [plans, subscription] = await Promise.all([
      deps.billing.getPlanList({ limit: 100, payerType: "org" }),
      deps.billing.getOrganizationBillingSubscription(actor.orgId),
    ]);

    return {
      plans: deps.toPlainClerkResource(plans.data) as OrgBillingPlan[],
      subscription: deps.toPlainClerkResource(
        subscription
      ) as OrgBillingSubscription,
    };
  },
});

export const cancelOrgBillingSubscriptionItemCommand = defineCommand<
  "orgBilling.cancelSubscriptionItem",
  typeof cancelOrgBillingSubscriptionItemInput,
  typeof billingSubscriptionItemOutput,
  OrgBillingCommandDeps
>({
  name: "orgBilling.cancelSubscriptionItem",
  input: cancelOrgBillingSubscriptionItemInput,
  output: billingSubscriptionItemOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const subscription = await deps.billing.getOrganizationBillingSubscription(
      actor.orgId
    );
    const item = subscription.subscriptionItems.find(
      (subscriptionItem) => subscriptionItem.id === input.subscriptionItemId
    );

    if (!item) {
      throw new AuthzError(
        "SUBSCRIPTION_ITEM_FORBIDDEN",
        "Subscription item does not belong to this organization"
      );
    }

    if (item.plan?.slug !== "team") {
      throw new ValidationError(
        "ONLY_TEAM_PLAN_CANCELABLE",
        "Only the Team plan can be canceled"
      );
    }

    const canceledItem = await deps.billing.cancelSubscriptionItem(
      input.subscriptionItemId,
      {
        endNow: false,
      }
    );

    return deps.toPlainClerkResource(
      canceledItem
    ) as OrgBillingSubscriptionItem;
  },
});
