import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addPaymentMethodMock = vi.fn();
const cancelMutateMock = vi.fn();
const checkoutConfirmMock = vi.fn();
const checkoutFinalizeMock = vi.fn();
const checkoutStartMock = vi.fn();
const makeDefaultPaymentMethodMock = vi.fn();
const paymentSubmitMock = vi.fn();
const removePaymentMethodMock = vi.fn();
const revalidatePaymentMethodsMock = vi.fn();
const revalidateSubscriptionMock = vi.fn();
const useAuthMock = vi.fn();
const useCheckoutMock = vi.fn();
const useOrganizationMock = vi.fn();
const usePaymentElementMock = vi.fn();
const usePaymentMethodsMock = vi.fn();
const usePlansMock = vi.fn();
const useStatementsMock = vi.fn();
const useSubscriptionMock = vi.fn();

vi.mock("@repo/app-trpc/react", () => ({
  useTRPC: () => ({
    pendingNotAllowed: {
      orgBilling: {
        cancelSubscriptionItem: {
          mutationOptions: (options: unknown) => options,
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options?: { onSettled?: () => void }) => ({
    isPending: false,
    mutate: (input: unknown) => {
      cancelMutateMock(input);
      options?.onSettled?.();
    },
    variables: undefined,
  }),
}));

vi.mock("@vendor/clerk/client", () => ({
  CheckoutButton: () => <div data-testid="checkout-button" />,
  PlanDetailsButton: () => <div data-testid="plan-details-button" />,
  PricingTable: () => <div data-testid="pricing-table" />,
  Show: ({ children }: { children: ReactNode }) => <>{children}</>,
  SubscriptionDetailsButton: () => (
    <div data-testid="subscription-details-button" />
  ),
  useAuth: useAuthMock,
  useOrganization: useOrganizationMock,
}));

vi.mock("@vendor/clerk/client/experimental", () => ({
  CheckoutButton: () => <div data-testid="experimental-checkout-button" />,
  CheckoutProvider: ({
    children,
    for: payerType,
    planId,
  }: {
    children: ReactNode;
    for?: string;
    planId: string;
  }) => (
    <div
      data-for={payerType}
      data-plan-id={planId}
      data-testid="checkout-provider"
    >
      {children}
    </div>
  ),
  PaymentElement: ({ fallback }: { fallback?: ReactNode }) => (
    <div data-testid="payment-element">{fallback}</div>
  ),
  PaymentElementProvider: ({
    children,
    for: payerType,
  }: {
    children: ReactNode;
    for?: string;
  }) => (
    <div data-for={payerType} data-testid="payment-element-provider">
      {children}
    </div>
  ),
  PlanDetailsButton: () => <div data-testid="experimental-plan-details" />,
  SubscriptionDetailsButton: () => (
    <div data-testid="experimental-subscription-details" />
  ),
  useCheckout: useCheckoutMock,
  usePaymentElement: usePaymentElementMock,
  usePaymentMethods: usePaymentMethodsMock,
  usePlans: usePlansMock,
  useStatements: useStatementsMock,
  useSubscription: useSubscriptionMock,
}));

const { BillingSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-settings-client"
);

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
  createdAt: new Date("2023-11-14T00:00:00Z"),
  id: "sub_item_team",
  isFreeTrial: false,
  nextPayment: {
    amount: teamAmount,
    date: new Date("2023-11-15T00:00:00Z"),
  },
  pastDueAt: null,
  periodEnd: new Date("2023-11-15T00:00:00Z"),
  periodStart: new Date("2023-11-14T00:00:00Z"),
  plan: teamPlan,
  planId: "cplan_team",
  planPeriod: "month",
  status: "active",
};

function subscription(currentItem: typeof teamItem | null = teamItem) {
  return {
    activeAt: new Date("2023-11-14T00:00:00Z"),
    createdAt: new Date("2023-11-14T00:00:00Z"),
    eligibleForFreeTrial: false,
    id: "sub_org_acme",
    nextPayment: currentItem?.nextPayment ?? null,
    pastDueAt: null,
    status: "active",
    subscriptionItems: currentItem ? [currentItem] : [],
    updatedAt: new Date("2023-11-14T00:00:01Z"),
  };
}

function renderBilling() {
  return render(<BillingSettingsClient />);
}

function expectDialogsToUseShadcnColors() {
  const customColorPattern =
    /(?:^|\s)(?:hover:)?(?:bg|border|text)-(?:black|white|zinc)(?:[^\s]*)?/;
  const customColorClasses = Array.from(
    document.querySelectorAll('[role="dialog"], [role="dialog"] *')
  )
    .map((node) => node.getAttribute("class") ?? "")
    .flatMap((className) =>
      className
        .split(/\s+/)
        .filter((classToken) => customColorPattern.test(classToken))
    );

  expect(customColorClasses).toEqual([]);
}

beforeEach(() => {
  addPaymentMethodMock.mockReset();
  cancelMutateMock.mockReset();
  checkoutConfirmMock.mockReset();
  checkoutFinalizeMock.mockReset();
  checkoutStartMock.mockReset();
  makeDefaultPaymentMethodMock.mockReset();
  paymentSubmitMock.mockReset();
  removePaymentMethodMock.mockReset();
  revalidatePaymentMethodsMock.mockReset();
  revalidateSubscriptionMock.mockReset();
  useAuthMock.mockReset();
  useCheckoutMock.mockReset();
  useOrganizationMock.mockReset();
  usePaymentElementMock.mockReset();
  usePaymentMethodsMock.mockReset();
  usePlansMock.mockReset();
  useStatementsMock.mockReset();
  useSubscriptionMock.mockReset();

  addPaymentMethodMock.mockResolvedValue({});
  checkoutConfirmMock.mockResolvedValue({ error: null });
  checkoutFinalizeMock.mockResolvedValue(undefined);
  makeDefaultPaymentMethodMock.mockResolvedValue(null);
  paymentSubmitMock.mockResolvedValue({
    data: { gateway: "stripe", paymentToken: "pm_token_new" },
    error: null,
  });
  removePaymentMethodMock.mockResolvedValue({ deleted: true });
  revalidatePaymentMethodsMock.mockResolvedValue(undefined);
  revalidateSubscriptionMock.mockResolvedValue(undefined);

  useAuthMock.mockReturnValue({
    has: ({ role }: { role?: string }) => role === "org:admin",
    isLoaded: true,
    orgId: "org_acme",
  });
  useOrganizationMock.mockReturnValue({
    organization: {
      addPaymentMethod: addPaymentMethodMock,
      id: "org_acme",
    },
  });
  useCheckoutMock.mockReturnValue({
    checkout: {
      confirm: checkoutConfirmMock,
      finalize: checkoutFinalizeMock,
      plan: teamPlan,
      start: checkoutStartMock,
      status: "needs_confirmation",
      totals: {
        totalDueNow: teamAmount,
      },
    },
    errors: { global: null, raw: null },
    fetchStatus: "idle",
  });
  usePaymentElementMock.mockReturnValue({
    isFormReady: true,
    submit: paymentSubmitMock,
  });
  usePaymentMethodsMock.mockReturnValue({
    data: [
      {
        cardType: "visa",
        expiryMonth: 12,
        expiryYear: 2030,
        id: "pm_1",
        isDefault: true,
        isRemovable: false,
        last4: "4242",
        makeDefault: makeDefaultPaymentMethodMock,
        remove: removePaymentMethodMock,
        status: "active",
      },
      {
        cardType: "mastercard",
        expiryMonth: 1,
        expiryYear: 2031,
        id: "pm_2",
        isDefault: false,
        isRemovable: true,
        last4: "1111",
        makeDefault: makeDefaultPaymentMethodMock,
        remove: removePaymentMethodMock,
        status: "active",
      },
    ],
    isLoading: false,
    revalidate: revalidatePaymentMethodsMock,
  });
  usePlansMock.mockReturnValue({
    data: [starterPlan, teamPlan],
    isLoading: false,
  });
  useStatementsMock.mockReturnValue({
    data: [
      {
        groups: [],
        id: "stmt_1",
        status: "closed",
        timestamp: new Date("2026-05-01T00:00:00Z"),
        totals: {
          grandTotal: teamAmount,
          subtotal: teamAmount,
          taxTotal: null,
        },
      },
    ],
    isLoading: false,
  });
  useSubscriptionMock.mockReturnValue({
    data: subscription(),
    isLoading: false,
    revalidate: revalidateSubscriptionMock,
  });
});

describe("billing settings client", () => {
  it("loads billing data from Clerk billing hooks", () => {
    renderBilling();

    expect(usePlansMock).toHaveBeenCalledWith({
      for: "organization",
      pageSize: 100,
    });
    expect(useSubscriptionMock).toHaveBeenCalledWith({ for: "organization" });
    expect(usePaymentMethodsMock).toHaveBeenCalledWith({
      for: "organization",
      pageSize: 20,
    });
    expect(useStatementsMock).toHaveBeenCalledWith({
      for: "organization",
      pageSize: 10,
    });
  });

  it("renders OpenAI-style billing sections without inline plan cards or Clerk managed components", () => {
    renderBilling();

    expect(
      screen.queryByRole("heading", { name: "Plan" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Team")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Payment" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Invoices" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cancellation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Adjust plan" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel plan" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Visa.*4242/i)).toBeInTheDocument();

    expect(screen.queryByText("Available Plans")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pricing-table")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("subscription-details-button")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("checkout-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("plan-details-button")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("experimental-subscription-details")
    ).not.toBeInTheDocument();
  });

  it("does not render a decorative icon in the billing plan row", () => {
    renderBilling();

    const planSection = screen
      .getByRole("button", { name: "Adjust plan" })
      .closest("section");

    expect(planSection?.querySelector("svg")).toBeNull();
  });

  it("renders read-only billing status for non-admin members", () => {
    useAuthMock.mockReturnValue({
      has: ({ role }: { role?: string }) => role !== "org:admin",
      isLoaded: true,
      orgId: "org_acme",
    });

    renderBilling();

    expect(screen.getAllByText("Team")[0]).toBeInTheDocument();
    expect(screen.getByText(/Visa.*4242/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(
      screen.getByText("Billing is managed by organization admins.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Adjust plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Update")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel plan")).not.toBeInTheDocument();
  });

  it("opens a full-screen plan modal and confirms a starter downgrade", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose your plan" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Starter" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Business" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to Starter" }));

    expect(
      screen.getByRole("heading", { name: "Confirm plan changes" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(cancelMutateMock).toHaveBeenCalledWith({
      subscriptionItemId: "sub_item_team",
    });
    expect(revalidateSubscriptionMock).toHaveBeenCalled();
  });

  it("confirms Team selection before opening checkout", () => {
    useSubscriptionMock.mockReturnValue({
      data: subscription(null),
      isLoading: false,
      revalidate: revalidateSubscriptionMock,
    });

    renderBilling();
    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to Team" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(screen.getByTestId("checkout-provider")).toHaveAttribute(
      "data-for",
      "organization"
    );
    expect(screen.getByTestId("checkout-provider")).toHaveAttribute(
      "data-plan-id",
      "cplan_team"
    );
    expect(screen.getByText("Use saved card")).toBeInTheDocument();
    expect(screen.getByText("Use new card")).toBeInTheDocument();
  });

  it("confirms Business selection with the sales mailto", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Contact Sales" }));

    expect(
      screen.getByRole("heading", { name: "Confirm plan changes" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirm" })).toHaveAttribute(
      "href",
      "mailto:sales@lightfast.ai"
    );
  });

  it("uses shadcn theme tokens instead of custom dialog colors", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));
    expectDialogsToUseShadcnColors();

    fireEvent.click(screen.getByRole("button", { name: "Switch to Starter" }));
    expectDialogsToUseShadcnColors();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close plan chooser" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expectDialogsToUseShadcnColors();

    fireEvent.click(screen.getByRole("button", { name: "Add new card" }));
    expectDialogsToUseShadcnColors();
  });

  it("updates saved payment methods and adds a new card from the payment modal", async () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(
      screen.getByRole("heading", { name: "Payment method" })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Visa.*4242/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Mastercard.*1111/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Make default" }));
    await waitFor(() =>
      expect(makeDefaultPaymentMethodMock).toHaveBeenCalledWith({
        orgId: "org_acme",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(removePaymentMethodMock).toHaveBeenCalledWith({
        orgId: "org_acme",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Add new card" }));

    expect(screen.getByTestId("payment-element-provider")).toHaveAttribute(
      "data-for",
      "organization"
    );
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() =>
      expect(addPaymentMethodMock).toHaveBeenCalledWith({
        gateway: "stripe",
        paymentToken: "pm_token_new",
      })
    );
    expect(revalidatePaymentMethodsMock).toHaveBeenCalled();
  });

  it("opens statement details from the invoices table", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(
      screen.getByRole("heading", { name: "Invoice details" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("May 1, 2026")[0]).toBeInTheDocument();
    expect(screen.getAllByText("$60.00")[0]).toBeInTheDocument();
  });
});
