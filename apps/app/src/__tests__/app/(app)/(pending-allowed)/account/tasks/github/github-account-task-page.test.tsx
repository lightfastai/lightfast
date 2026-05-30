import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prefetchMock = vi.fn();
const serverStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));
const clientStatusQueryOptionsMock = vi.fn(() => ({
  queryKey: [["viewer", "githubAccount", "status"]],
}));
const startMutationOptionsMock = vi.fn((options: unknown) => options);
const mutateAsyncMock = vi.fn();
const assignMock = vi.fn();

Object.defineProperty(window, "location", {
  value: { assign: assignMock },
  writable: true,
});

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => <>{children}</>,
  prefetch: prefetchMock,
  trpc: {
    viewer: {
      githubAccount: {
        status: { queryOptions: serverStatusQueryOptionsMock },
      },
    },
  },
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: {
        status: { queryOptions: clientStatusQueryOptionsMock },
        start: { mutationOptions: startMutationOptionsMock },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
  useSuspenseQuery: () => ({
    data: { account: null },
  }),
}));

const { default: GitHubAccountTaskPage } = await import(
  "~/app/(app)/(pending-allowed)/account/tasks/github/page"
);

beforeEach(() => {
  prefetchMock.mockClear();
  serverStatusQueryOptionsMock.mockClear();
  clientStatusQueryOptionsMock.mockClear();
  startMutationOptionsMock.mockClear();
  mutateAsyncMock.mockReset();
  assignMock.mockReset();
});

describe("/account/tasks/github", () => {
  it("renders the GitHub account task and starts the account OAuth flow", async () => {
    mutateAsyncMock.mockResolvedValue({
      authorizationUrl:
        "https://github.lightfast.localhost/login/oauth/authorize",
    });

    render(
      await GitHubAccountTaskPage({
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole("heading", { name: "Connect your GitHub account" })
    ).toBeInTheDocument();

    const connectButton = screen.getByRole("button", {
      name: /connect github account/i,
    });
    expect(connectButton).toBeInTheDocument();

    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(prefetchMock).toHaveBeenCalledWith({
        queryKey: [["viewer", "githubAccount", "status"]],
      });
      expect(startMutationOptionsMock).toHaveBeenCalledWith({
        meta: { errorTitle: "Failed to connect GitHub" },
      });
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        returnTo: "/account/tasks/github",
      });
      expect(assignMock).toHaveBeenCalledWith(
        "https://github.lightfast.localhost/login/oauth/authorize"
      );
    });
  });
});
