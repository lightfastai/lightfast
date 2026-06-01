import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let githubAccountStatus: {
  account: null | {
    provider: "github";
    providerUserId: string;
    status: "active";
  };
} = { account: null };

const clientAccountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const createUsernameMutationOptionsMock = vi.fn((options: unknown) => options);
const statusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));
const prefetchMock = vi.fn();
const accountGetQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "account", "get"]],
}));
const serverGithubStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      account: {
        createUsername: {
          mutationOptions: createUsernameMutationOptionsMock,
        },
        get: { queryOptions: clientAccountGetQueryOptionsMock },
        updateName: {
          mutationOptions: updateNameMutationOptionsMock,
        },
      },
      githubAccount: {
        status: { queryOptions: statusQueryOptionsMock },
      },
    },
  }),
}));

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      account: {
        get: { queryOptions: accountGetQueryOptionsMock },
      },
      githubAccount: {
        status: { queryOptions: serverGithubStatusQueryOptionsMock },
      },
    },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => ({
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: (options: { queryKey: string[][] }) => {
    if (options.queryKey[0]?.join(".") === "viewer.account.get") {
      return {
        data: {
          fullName: "Test User",
          initials: "TU",
          primaryEmailAddress: "test@example.com",
          username: "test-user",
        },
      };
    }

    return {
      data: githubAccountStatus,
    };
  },
}));

const { GithubAccountConnectionSection } = await import(
  "~/app/(app)/(pending-allowed)/account/settings/general/_components/github-account-connection-section"
);

beforeEach(() => {
  githubAccountStatus = { account: null };
  clientAccountGetQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  createUsernameMutationOptionsMock.mockClear();
  statusQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
  accountGetQueryOptionsMock.mockClear();
  serverGithubStatusQueryOptionsMock.mockClear();
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

  it("prefetches account and GitHub status for the General settings page", async () => {
    const { default: GeneralSettingsPage } = await import(
      "~/app/(app)/(pending-allowed)/account/settings/general/page"
    );

    render(<GeneralSettingsPage />);

    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "account", "get"]],
      })
    );
    expect(prefetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [["viewer", "githubAccount", "status"]],
      })
    );
  });
});
