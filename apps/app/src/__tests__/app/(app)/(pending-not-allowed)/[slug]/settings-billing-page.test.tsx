import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const overviewQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgBilling", "overview"],
}));

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-billing">{children}</div>
  ),
  trpc: {
    org: {
      settings: {
        orgBilling: {
          overview: {
            queryOptions: overviewQueryOptionsMock,
          },
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
      plans: [],
      subscription: null,
    });

    const element = await BillingPage();
    render(element);

    expect(overviewQueryOptionsMock).toHaveBeenCalledOnce();
    expect(fetchQueryMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgBilling", "overview"],
    });
    expect(screen.getByTestId("hydrated-billing")).toHaveTextContent(
      "Billing client island"
    );
  });
});
