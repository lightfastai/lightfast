import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const overviewQueryOptionsMock = vi.fn(() => ({
  queryKey: ["pendingNotAllowed", "orgBilling", "overview"],
}));

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-billing">{children}</div>
  ),
  trpc: {
    pendingNotAllowed: {
      orgBilling: {
        overview: {
          queryOptions: overviewQueryOptionsMock,
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/_components/billing-settings-client",
  () => ({
    BillingSettingsClient: () => <div>Billing client island</div>,
  })
);

const { default: BillingPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  overviewQueryOptionsMock.mockClear();
});

describe("billing settings page", () => {
  it("awaits the billing overview query before rendering the hydrated client island", async () => {
    fetchQueryMock.mockResolvedValue({
      isAdmin: true,
      orgId: "org_acme",
      plans: [],
      subscription: null,
    });

    const element = await BillingPage();
    render(element);

    expect(overviewQueryOptionsMock).toHaveBeenCalledOnce();
    expect(fetchQueryMock).toHaveBeenCalledWith({
      queryKey: ["pendingNotAllowed", "orgBilling", "overview"],
    });
    expect(screen.getByTestId("hydrated-billing")).toHaveTextContent(
      "Billing client island"
    );
  });
});
