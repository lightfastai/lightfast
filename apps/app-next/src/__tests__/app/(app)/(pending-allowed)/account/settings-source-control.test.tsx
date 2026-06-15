import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let githubAccountStatus: {
  account: null | {
    accessTokenExpiresAt: Date;
    connectedAt: Date;
    provider: "github";
    providerUserId: string;
    refreshTokenExpiresAt: Date;
    status: "active";
  };
} = { account: null };

const statusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));
const prefetchMock = vi.fn();
const serverStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: { status: { queryOptions: statusQueryOptionsMock } },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      githubAccount: { status: { queryOptions: serverStatusQueryOptionsMock } },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({ data: githubAccountStatus }),
}));

const { AccountSourceControlClient } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/source-control/_components/account-source-control-client"
);

beforeEach(() => {
  githubAccountStatus = { account: null };
  statusQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
  serverStatusQueryOptionsMock.mockClear();
});

describe("AccountSourceControlClient", () => {
  it("offers a connect CTA when no account is linked", () => {
    render(<AccountSourceControlClient />);

    expect(
      screen.getByRole("heading", { name: /source control & git/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /connect github account/i })
    ).toHaveAttribute("href", "/account/tasks/github");
  });

  it("renders the connector card with the GitHub user id when linked", () => {
    githubAccountStatus = {
      account: {
        accessTokenExpiresAt: new Date("2026-07-01T00:00:00Z"),
        connectedAt: new Date("2026-06-01T00:00:00Z"),
        provider: "github",
        providerUserId: "12345",
        refreshTokenExpiresAt: new Date("2026-12-01T00:00:00Z"),
        status: "active",
      },
    };

    render(<AccountSourceControlClient />);

    // The card shows the linked identity + the "Connected" status pill trigger.
    // "View GitHub setup" lives inside a closed Radix dropdown, so it is not in
    // the DOM until opened — assert only on the visible card content here.
    expect(screen.getByText("github:12345")).toBeVisible();
    expect(screen.getByRole("button", { name: /connected/i })).toBeVisible();
    expect(
      screen.queryByText(/connect github account/i)
    ).not.toBeInTheDocument();
  });

  it("prefetches the GitHub account status for the page", async () => {
    const { default: SourceControlPage } = await import(
      "~/app/(app)/(pending-allowed)/account/settings/source-control/page"
    );

    render(SourceControlPage());

    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "githubAccount", "status"]],
      })
    );
  });
});
