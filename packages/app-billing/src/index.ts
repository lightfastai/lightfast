import type { BillingMoneyAmount } from "@vendor/clerk";
import type {
  BillingPlan as ClerkBillingPlan,
  BillingSubscriptionItem as ClerkBillingSubscriptionItem,
} from "@vendor/clerk/server";

export type BillingTier = "starter" | "team";

type BillingPlanLike = Pick<ClerkBillingPlan, "fee" | "isDefault" | "slug">;
type BillingSubscriptionItemLike = Pick<
  ClerkBillingSubscriptionItem,
  "plan" | "status"
>;

type BillingSubscriptionLike<T extends BillingSubscriptionItemLike> = Record<
  "subscriptionItems",
  T[]
>;

type ClerkErrorLike = Partial<
  Record<"code" | "longMessage" | "message", string | null>
> &
  Partial<Record<"error", Partial<Record<"code" | "message", string | null>>>>;

type PaymentErrorLike = Partial<Record<"code" | "message", string | null>> &
  Partial<Record<"error", Partial<Record<"code" | "message", string | null>>>>;

type BillingPlanPriceLike = Partial<Record<"fee", BillingMoneyAmount | null>>;

type BillingMoneyLike = Pick<
  BillingMoneyAmount,
  "amountFormatted" | "currencySymbol"
>;

type BillingTierPlanLike = Pick<ClerkBillingPlan, "isDefault" | "slug">;

type BillingPaymentMethodDefaultLike = Partial<
  Record<"cardType" | "last4", string | null>
> &
  Partial<Record<"isDefault", boolean | null>>;

export const businessContact = {
  email: "sales@lightfast.ai",
  href: "mailto:sales@lightfast.ai",
  label: "Contact Sales",
} as const;

// Clerk renders the Stripe PaymentElement inside a cross-origin iframe, so it
// cannot read app CSS custom properties. These are the resolved dark-mode UI
// token values used by the billing screens.
export const billingStripeAppearance = {
  colorPrimary: "#a0a0a0",
  colorBackground: "#1f1f1f",
  colorText: "#d9d9d9",
  colorTextSecondary: "#a1a1a1",
  colorSuccess: "#d9d9d9",
  colorDanger: "#e06666",
  colorWarning: "#a1a1a1",
  fontWeightNormal: "400",
  fontWeightMedium: "500",
  fontWeightBold: "600",
  fontSizeXl: "20px",
  fontSizeLg: "16px",
  fontSizeSm: "14px",
  fontSizeXs: "12px",
  borderRadius: "4px",
  spacingUnit: "4px",
} as const;

export function formatMoney(amount?: BillingMoneyLike | null) {
  if (!amount) {
    return "Free";
  }
  return `${amount.currencySymbol}${amount.amountFormatted}`;
}

export function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function statementStatusLabel(status: string) {
  return status === "closed" ? "Paid" : statusLabel(status);
}

export function tierForPlan(
  plan?: BillingTierPlanLike | null
): BillingTier | null {
  if (!plan) {
    return null;
  }
  if (plan.slug === "team") {
    return "team";
  }
  if (plan.slug === "starter" || plan.slug === "free_org" || plan.isDefault) {
    return "starter";
  }
  return null;
}

export function planAmountLabel(plan?: BillingPlanPriceLike | null) {
  if (!plan?.fee) {
    return "Free";
  }
  return `${formatMoney(plan.fee)}/month`;
}

export function cardLabel(method?: BillingPaymentMethodDefaultLike | null) {
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
    const billingError = error as ClerkErrorLike;
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
    const paymentError = error as PaymentErrorLike;
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

export function getStarterPlan<T extends BillingPlanLike>(plans: T[]) {
  return plans.find((plan) => tierForPlan(plan) === "starter") ?? null;
}

export function getTeamPlan<T extends BillingPlanLike>(plans: T[]) {
  return plans.find((plan) => tierForPlan(plan) === "team") ?? null;
}

export function getCurrentSubscriptionItem<
  T extends BillingSubscriptionItemLike,
>(subscription?: BillingSubscriptionLike<T> | null) {
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

export function getDefaultPaymentMethod<
  T extends { isDefault?: boolean | null },
>(paymentMethods: T[]) {
  return (
    paymentMethods.find((method) => method.isDefault) ??
    paymentMethods[0] ??
    null
  );
}
