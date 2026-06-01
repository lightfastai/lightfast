import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clientAccountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const prefetchMock = vi.fn();
const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const mutationMock = vi.fn(() => ({
  isPending: false,
  mutate: vi.fn(),
}));
const setQueryDataMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: { get: { queryOptions: clientAccountGetQueryOptionsMock } },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      account: { get: { queryOptions: accountGetQueryOptionsMock } },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mutationMock,
  useQueryClient: () => ({ setQueryData: setQueryDataMock }),
  useSuspenseQuery: () => ({
    data: {
      fullName: "Test User",
      initials: "TU",
      primaryEmailAddress: "test@example.com",
      username: "test-user",
    },
  }),
}));

const { ProfileDataDisplay } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/profile-data-display"
);

beforeEach(() => {
  clientAccountGetQueryOptionsMock.mockClear();
  mutationMock.mockClear();
  prefetchMock.mockClear();
  accountGetQueryOptionsMock.mockClear();
  setQueryDataMock.mockClear();
});

describe("account General settings", () => {
  it("renders profile rows without the GitHub section", () => {
    render(<ProfileDataDisplay />);

    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Display name")).toBeVisible();
    expect(screen.getByText("Username")).toBeVisible();
    expect(screen.getByText("Email")).toBeVisible();
    expect(screen.getByDisplayValue("Test User")).toBeVisible();
    expect(screen.getByDisplayValue("test-user")).toBeVisible();
    expect(screen.getByDisplayValue("test@example.com")).toBeVisible();
    expect(screen.queryByText(/github/i)).not.toBeInTheDocument();
  });

  it("prefetches only the account profile for the General page", async () => {
    const { default: GeneralSettingsPage } = await import(
      "~/app/(app)/(pending-allowed)/account/settings/general/page"
    );

    render(<GeneralSettingsPage />);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "account", "get"]],
      })
    );
  });
});
