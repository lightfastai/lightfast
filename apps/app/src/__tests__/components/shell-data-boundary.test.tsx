import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accountQueryOptions = vi.fn(() => ({
  queryKey: ["viewer", "account", "get"],
}));
const hydrateClient = vi.fn(({ children }: { children?: ReactNode }) => (
  <div data-testid="shell-hydration">{children}</div>
));
const organizationListQueryOptions = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const prefetch = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: hydrateClient,
  prefetch,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: accountQueryOptions },
      },
      organization: {
        listUserOrganizations: {
          queryOptions: organizationListQueryOptions,
        },
      },
    },
  },
}));

const { ShellDataBoundary } = await import("~/components/shell-data-boundary");

beforeEach(() => {
  accountQueryOptions.mockClear();
  hydrateClient.mockClear();
  organizationListQueryOptions.mockClear();
  prefetch.mockClear();
});

describe("ShellDataBoundary", () => {
  it("prefetches shell account and organization queries before hydrating children", () => {
    render(
      <ShellDataBoundary>
        <div>Shell child</div>
      </ShellDataBoundary>
    );

    expect(organizationListQueryOptions).toHaveBeenCalledOnce();
    expect(accountQueryOptions).toHaveBeenCalledOnce();
    expect(prefetch).toHaveBeenCalledWith({
      queryKey: ["viewer", "organization", "listUserOrganizations"],
    });
    expect(prefetch).toHaveBeenCalledWith({
      queryKey: ["viewer", "account", "get"],
    });
    expect(screen.getByTestId("shell-hydration")).toHaveTextContent(
      "Shell child"
    );
  });
});
