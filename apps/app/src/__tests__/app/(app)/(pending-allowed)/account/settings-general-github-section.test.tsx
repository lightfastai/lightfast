import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let githubAccountStatus: {
  account: null | {
    provider: "github";
    providerUserId: string;
    status: "active";
  };
} = { account: null };

const statusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: {
        status: { queryOptions: statusQueryOptionsMock },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: () => ({
    data: githubAccountStatus,
  }),
}));

const { GithubAccountConnectionSection } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section"
);

beforeEach(() => {
  githubAccountStatus = { account: null };
  statusQueryOptionsMock.mockClear();
});

describe("GithubAccountConnectionSection", () => {
  it("links disconnected users to the GitHub account task", () => {
    render(<GithubAccountConnectionSection />);

    expect(
      screen.getByRole("heading", { name: "GitHub account" })
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeVisible();

    const link = screen.getByRole("link", {
      name: /connect github account/i,
    });
    expect(link).toHaveAttribute("href", "/account/tasks/github");
    expect(statusQueryOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("shows the connected GitHub user id and keeps setup routing available", () => {
    githubAccountStatus = {
      account: {
        provider: "github",
        providerUserId: "12345",
        status: "active",
      },
    };

    render(<GithubAccountConnectionSection />);

    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("github:12345")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /view github setup/i })
    ).toHaveAttribute("href", "/account/tasks/github");
  });
});
