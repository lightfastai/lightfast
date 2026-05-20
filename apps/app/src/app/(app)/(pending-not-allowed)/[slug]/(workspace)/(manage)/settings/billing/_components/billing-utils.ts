import type { AppRouterOutputs } from "@api/app";
import type {
  BillingPaymentMethodResource,
} from "@vendor/clerk/client/experimental";

export type BillingOverview =
  AppRouterOutputs["pendingNotAllowed"]["orgBilling"]["overview"];
export type BillingPlan = BillingOverview["plans"][number];
export type BillingSubscription = BillingOverview["subscription"];
export type BillingSubscriptionItem =
  BillingSubscription["subscriptionItems"][number];

export type BillingMoneyAmount = {
  amountFormatted: string;
  currencySymbol: string;
};

export const businessContact = {
  email: "sales@lightfast.ai",
  href: "mailto:sales@lightfast.ai",
  label: "Contact Sales",
} as const;

export function formatMoney(amount?: BillingMoneyAmount | null) {
  if (!amount) {
    return "Free";
  }
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}

export function formatDate(value?: Date | number | null) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function statementStatusLabel(status: string) {
  return status === "closed" ? "Paid" : statusLabel(status);
}

export function tierForPlan(
  plan?: Pick<BillingPlan, "isDefault" | "slug"> | null
) {
  if (!plan) {
    return null;
  }
  if (plan.slug === "team") {
    return "team" as const;
  }
  if (plan.slug === "starter" || plan.slug === "free_org" || plan.isDefault) {
    return "starter" as const;
  }
  return null;
}

export function planAmountLabel(
  plan?: Pick<BillingPlan, "fee"> | { fee?: BillingMoneyAmount | null } | null
) {
  if (!plan?.fee) {
    return "Free";
  }
  return `${formatMoney(plan.fee)}/month`;
}

export function cardLabel(method?: BillingPaymentMethodResource | null) {
  if (!method) {
    return "No payment method";
  }
  const cardType = method.cardType
    ? `${method.cardType.charAt(0).toUpperCase()}${method.cardType.slice(1)}`
    : "Card";
  return `${cardType} •••• ${method.last4 ?? "----"}`;
}

export function checkoutErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const billingError = error as {
      code?: string | null;
      error?: { code?: string | null; message?: string | null };
      longMessage?: string | null;
      message?: string | null;
    };
    return (
      billingError.longMessage ??
      billingError.message ??
      billingError.error?.message ??
      billingError.error?.code ??
      billingError.code ??
      "Checkout failed"
    );
  }
  return "Checkout failed";
}

export function paymentErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const paymentError = error as {
      code?: string | null;
      error?: { code?: string | null; message?: string | null };
      message?: string | null;
    };
    return (
      paymentError.message ??
      paymentError.error?.message ??
      paymentError.error?.code ??
      paymentError.code ??
      "Payment method could not be updated"
    );
  }
  return "Payment method could not be updated";
}

export function getStarterPlan(plans: BillingPlan[]) {
  return plans.find((plan) => tierForPlan(plan) === "starter") ?? null;
}

export function getTeamPlan(plans: BillingPlan[]) {
  return plans.find((plan) => tierForPlan(plan) === "team") ?? null;
}

export function getCurrentSubscriptionItem(
  subscription?: BillingSubscription | null
) {
  const activeItems =
    subscription?.subscriptionItems.filter(
      (item) => item.status === "active" || item.status === "past_due"
    ) ?? [];

  return (
    activeItems.find((item) => tierForPlan(item.plan) === "team") ??
    activeItems[0] ??
    null
  );
}

export function getDefaultPaymentMethod(
  paymentMethods: BillingPaymentMethodResource[]
) {
  return (
    paymentMethods.find((method) => method.isDefault) ??
    paymentMethods[0] ??
    null
  );
}
