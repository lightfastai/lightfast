import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const overviewQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgBilling", "overview"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-billing">{children}</div>
  ),
  prefetch: prefetchMock,
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
  overviewQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("billing settings page", () => {
  it("prefetches the billing overview before rendering the hydrated client island", async () => {
    const element = await BillingPage();
    render(element);

    expect(overviewQueryOptionsMock).toHaveBeenCalledOnce();
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgBilling", "overview"],
    });
    expect(screen.getByTestId("hydrated-billing")).toHaveTextContent(
      "Billing client island"
    );
  });
});
