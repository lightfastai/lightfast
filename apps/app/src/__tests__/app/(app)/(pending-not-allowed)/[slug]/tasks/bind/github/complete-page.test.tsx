import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn();
const reloadMock = vi.fn();
const replaceMock = vi.fn();
const syncMutationOptionsMock = vi.fn((options: unknown) => options);

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      setup: {
        github: {
          syncBindingClaim: {
            mutationOptions: syncMutationOptionsMock,
          },
        },
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

vi.mock("@vendor/clerk", () => ({
  useSession: () => ({ session: { reload: reloadMock } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const { GitHubBindCompleteClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/github/complete/_components/github-bind-complete-client"
);

beforeEach(() => {
  mutateAsyncMock.mockReset();
  reloadMock.mockReset();
  replaceMock.mockReset();
  syncMutationOptionsMock.mockClear();
});

describe("GitHubBindCompleteClient", () => {
  it("syncs the binding claim, reloads the Clerk session, and returns to workspace", async () => {
    mutateAsyncMock.mockResolvedValue({ bindingStatus: "bound" });
    reloadMock.mockResolvedValue(undefined);

    render(<GitHubBindCompleteClient orgSlug="acme" />);

    await waitFor(() => {
      expect(syncMutationOptionsMock).toHaveBeenCalledWith({
        meta: { errorTitle: "Failed to finish GitHub connection" },
      });
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });

  it("shows a retry button when syncing fails", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("clerk failed"));

    render(<GitHubBindCompleteClient orgSlug="acme" />);

    expect(
      await screen.findByRole("button", { name: "Retry" })
    ).toBeInTheDocument();

    mutateAsyncMock.mockResolvedValueOnce({ bindingStatus: "bound" });
    reloadMock.mockResolvedValue(undefined);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });
});
