import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { formatUtcCalendarDate as formatDate } from "@vendor/lib/time";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addPaymentMethodMock = vi.fn();
const cancelMutateMock = vi.fn();
const cancelQueriesMock = vi.fn();
const checkoutConfirmMock = vi.fn();
const checkoutFinalizeMock = vi.fn();
const checkoutStartMock = vi.fn();
const getQueryDataMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const makeDefaultPaymentMethodMock = vi.fn();
const overviewQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgBilling", "overview"],
}));
const paymentSubmitMock = vi.fn();
const removePaymentMethodMock = vi.fn();
const revalidatePaymentMethodsMock = vi.fn();
const setQueryDataMock = vi.fn();
const suspenseQueryOptionsMock = vi.fn();
const useAuthMock = vi.fn();
const useCheckoutMock = vi.fn();
const useOrganizationMock = vi.fn();
const usePaymentElementMock = vi.fn();
const usePaymentMethodsMock = vi.fn();
const usePlansMock = vi.fn();
const useStatementsMock = vi.fn();
const useSubscriptionMock = vi.fn();
let overviewData: ReturnType<typeof overview>;

vi.mock("@repo/app-trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgBilling: {
          overview: {
            queryOptions: overviewQueryOptionsMock,
          },
          cancelSubscriptionItem: {
            mutationOptions: (options: unknown) => options,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options?: {
    onMutate?: (input: unknown) => unknown;
    onSettled?: (
      data: unknown,
      error: unknown,
      input: unknown,
      context: unknown
    ) => void;
  }) => ({
    isPending: false,
    mutate: (input: unknown) => {
      cancelMutateMock(input);
      void Promise.resolve(options?.onMutate?.(input)).then((context) => {
        options?.onSettled?.(undefined, null, input, context);
      });
    },
    variables: undefined,
  }),
  useQueryClient: () => ({
    cancelQueries: cancelQueriesMock,
    getQueryData: getQueryDataMock,
    invalidateQueries: invalidateQueriesMock,
    setQueryData: setQueryDataMock,
  }),
  useSuspenseQuery: (options: unknown) => {
    suspenseQueryOptionsMock(options);
    return { data: overviewData };
  },
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

// The checkout components call useRouter() for the post-finalize soft
// navigation; without a mock it throws "app router to be mounted" in jsdom.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
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

// UTC-anchored calendar date for the mock statement. The test derives the
// expected display string via formatDate so it stays independent of the host
// machine's locale and timezone.
const STATEMENT_TIMESTAMP = new Date("2026-05-01T00:00:00Z");

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

function overview(currentItem: typeof teamItem | null = teamItem) {
  return {
    plans: [starterPlan, teamPlan],
    subscription: subscription(currentItem),
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

function getPlanChoiceCard(planName: string) {
  const heading = screen.getByRole("heading", { name: planName });
  const card = heading.parentElement?.parentElement;

  expect(card).toBeInstanceOf(HTMLElement);

  return card as HTMLElement;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/somerandomteam/settings/billing");

  addPaymentMethodMock.mockReset();
  cancelMutateMock.mockReset();
  cancelQueriesMock.mockReset();
  checkoutConfirmMock.mockReset();
  checkoutFinalizeMock.mockReset();
  checkoutStartMock.mockReset();
  getQueryDataMock.mockReset();
  invalidateQueriesMock.mockReset();
  makeDefaultPaymentMethodMock.mockReset();
  overviewQueryOptionsMock.mockClear();
  paymentSubmitMock.mockReset();
  removePaymentMethodMock.mockReset();
  revalidatePaymentMethodsMock.mockReset();
  setQueryDataMock.mockReset();
  suspenseQueryOptionsMock.mockClear();
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
  overviewData = overview();
  getQueryDataMock.mockImplementation(() => overviewData);
  setQueryDataMock.mockImplementation((_queryKey, value) => {
    overviewData = typeof value === "function" ? value(overviewData) : value;
  });

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
        timestamp: STATEMENT_TIMESTAMP,
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
  });
});

describe("billing settings client", () => {
  it("loads SSR billing overview from tRPC and keeps Clerk client hooks for client-only data", () => {
    renderBilling();

    expect(overviewQueryOptionsMock).toHaveBeenCalledOnce();
    expect(suspenseQueryOptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["org", "settings", "orgBilling", "overview"],
      })
    );
    expect(usePlansMock).not.toHaveBeenCalled();
    expect(useSubscriptionMock).not.toHaveBeenCalled();
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

  it("renders the plan chooser with pricing-page card treatment", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));

    const dialog = screen.getByRole("dialog");
    const leanShell = dialog.querySelector(".max-w-6xl");
    const starterHeading = screen.getByRole("heading", { name: "Starter" });
    const teamHeading = screen.getByRole("heading", { name: "Team" });
    const starterCard = getPlanChoiceCard("Starter");
    const teamCard = getPlanChoiceCard("Team");
    const businessCard = getPlanChoiceCard("Business");

    expect(dialog).toHaveClass("h-dvh", "p-0");
    expect(dialog).not.toHaveClass("p-6", "md:p-10");
    expect(leanShell).toBeInstanceOf(HTMLElement);
    expect(leanShell).toHaveClass("max-w-6xl", "px-4", "py-10");
    expect(dialog.querySelector(".max-w-7xl")).toBeNull();
    expect(dialog.querySelector('[class*="min-h-"]')).toBeNull();
    expect(starterCard).toHaveClass("h-full", "rounded-sm", "bg-card", "p-6");
    expect(starterCard.className).not.toMatch(/min-h-\[/);
    expect(teamCard).toHaveClass(
      "h-full",
      "rounded-sm",
      "bg-card",
      "border-foreground",
      "shadow-lg"
    );
    expect(businessCard).toHaveClass("rounded-sm", "bg-card", "p-6");
    expect(starterHeading).toHaveClass("font-bold", "text-base");
    expect(teamHeading).toHaveClass("font-bold", "text-base");
    expect(teamHeading.parentElement?.querySelector("svg")).toBeNull();
    expect(screen.getByText("Up to 3 users")).toBeInTheDocument();
    expect(screen.getByText("2,500 searches/month total")).toBeInTheDocument();
    expect(
      screen.getByText("Semantic search (AI-powered)")
    ).toBeInTheDocument();
    expect(screen.getByText("Basic Decision Surfacing")).toBeInTheDocument();
    expect(screen.getByText("Minimum 3 users")).toBeInTheDocument();
    expect(screen.getByText("Scale as needed:")).toBeInTheDocument();
    expect(screen.getByText("+$10 per additional source")).toBeInTheDocument();
    expect(screen.getByText("Unlimited searches")).toBeInTheDocument();
    expect(screen.getByText("Advanced Decision Surfacing")).toBeInTheDocument();
    expect(screen.getByText("Temporal state tracking")).toBeInTheDocument();
  });

  it("opens the plan chooser from the pricing hash", async () => {
    window.history.replaceState(
      null,
      "",
      "/somerandomteam/settings/billing#pricing"
    );

    renderBilling();

    expect(
      await screen.findByRole("heading", { name: "Choose your plan" })
    ).toBeInTheDocument();
  });

  it("syncs the plan chooser open state to the pricing hash", () => {
    renderBilling();

    fireEvent.click(screen.getByRole("button", { name: "Adjust plan" }));

    expect(window.location.hash).toBe("#pricing");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(window.location.hash).toBe("");
  });

  it("renders read-only billing status for non-admin members", () => {
    useAuthMock.mockReturnValue({
      has: () => false,
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

  it("optimistically schedules a starter downgrade from the plan modal", async () => {
    const view = renderBilling();

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
    const confirmDialog = screen
      .getByRole("heading", { name: "Confirm plan changes" })
      .closest('[role="dialog"]');
    const summaryCard =
      confirmDialog?.querySelector("h3")?.parentElement?.parentElement;

    expect(confirmDialog).toHaveClass("sm:max-w-xl", "p-6");
    expect(summaryCard).toBeInstanceOf(HTMLElement);
    expect(summaryCard).toHaveClass("mt-4", "p-5");
    expect(summaryCard).not.toHaveClass("mt-6", "p-6");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(cancelMutateMock).toHaveBeenCalledWith({
      subscriptionItemId: "sub_item_team",
    });
    await waitFor(() => expect(setQueryDataMock).toHaveBeenCalled());
    view.rerender(<BillingSettingsClient />);
    expect(screen.getAllByText(/Team plan is scheduled to end/i)).toHaveLength(
      2
    );
    expect(screen.queryByRole("button", { name: "Cancel plan" })).toBeNull();
    expect(cancelQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgBilling", "overview"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgBilling", "overview"],
    });
  });

  it("confirms Team selection before opening checkout", () => {
    overviewData = overview(null);

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
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
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
    const statementDate = formatDate(STATEMENT_TIMESTAMP);
    expect(statementDate).toBeTruthy();
    expect(screen.getAllByText(statementDate ?? "")[0]).toBeInTheDocument();
    expect(screen.getAllByText("$60.00")[0]).toBeInTheDocument();
  });
});
