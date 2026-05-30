import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncMutationOptionsMock = vi.fn((options: unknown) => options);
const mutateAsyncMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      githubAccount: {
        sync: { mutationOptions: syncMutationOptionsMock },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const { default: GitHubAccountCompletePage } = await import(
  "~/app/(app)/(pending-allowed)/account/tasks/github/complete/page"
);

const connectedAccount = {
  account: {
    provider: "github",
    providerUserId: "12345",
    status: "active",
  },
};

async function renderCompletePage(returnTo?: string) {
  return render(
    await GitHubAccountCompletePage({
      searchParams: Promise.resolve(
        returnTo === undefined ? {} : { return_to: returnTo }
      ),
    })
  );
}

beforeEach(() => {
  syncMutationOptionsMock.mockClear();
  mutateAsyncMock.mockReset();
  replaceMock.mockReset();
});

describe("/account/tasks/github/complete", () => {
  it("syncs the GitHub account and returns to the task page by default", async () => {
    mutateAsyncMock.mockResolvedValue(connectedAccount);

    await renderCompletePage();

    expect(
      screen.getByRole("heading", {
        name: "Finishing GitHub connection...",
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(syncMutationOptionsMock).toHaveBeenCalledWith({
        meta: { errorTitle: "Failed to finish GitHub connection" },
      });
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/account/tasks/github");
    });
  });

  it("returns to a safe internal route from return_to", async () => {
    mutateAsyncMock.mockResolvedValue(connectedAccount);

    await renderCompletePage("/account/settings");

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/account/settings");
    });
  });

  it.each([
    ["external URL", "https://evil.example/path"],
    ["protocol-relative URL", "//evil.example/path"],
    ["backslash protocol-relative URL", "/\\evil.example/path"],
  ])("falls back for %s return_to values", async (_label, returnTo) => {
    mutateAsyncMock.mockResolvedValue(connectedAccount);

    await renderCompletePage(returnTo);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/account/tasks/github");
    });
  });

  it("starts syncing only once across rerenders", async () => {
    mutateAsyncMock.mockResolvedValue(connectedAccount);

    const view = await renderCompletePage();
    view.rerender(
      await GitHubAccountCompletePage({
        searchParams: Promise.resolve({}),
      })
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/account/tasks/github");
    });
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
  });
});
