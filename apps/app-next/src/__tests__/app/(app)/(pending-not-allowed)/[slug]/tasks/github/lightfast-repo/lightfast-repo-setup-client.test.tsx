import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn();
const reloadMock = vi.fn();
const replaceMock = vi.fn();
const verifyMutationOptionsMock = vi.fn((options: unknown) => options);

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      setup: {
        github: {
          verifyLightfastRepo: {
            mutationOptions: verifyMutationOptionsMock,
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

const { LightfastRepoSetupClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/github/lightfast-repo/_components/lightfast-repo-setup-client"
);

beforeEach(() => {
  mutateAsyncMock.mockReset();
  reloadMock.mockReset();
  replaceMock.mockReset();
  verifyMutationOptionsMock.mockClear();
});

describe("LightfastRepoSetupClient", () => {
  it("renders the required GitHub repository and create link", () => {
    render(
      <LightfastRepoSetupClient
        accountLogin="lightfast-emulated"
        newRepositoryUrl="https://github.lightfast.localhost/organizations/lightfast-emulated/repositories/new?name=.lightfast"
        orgSlug="acme"
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Create the .lightfast repository",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("lightfast-emulated/.lightfast")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open GitHub" })).toHaveAttribute(
      "href",
      "https://github.lightfast.localhost/organizations/lightfast-emulated/repositories/new?name=.lightfast"
    );
  });

  it("verifies the repository, reloads the session, and opens the workspace", async () => {
    mutateAsyncMock.mockResolvedValue({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });
    reloadMock.mockResolvedValue(undefined);

    render(
      <LightfastRepoSetupClient
        accountLogin="lightfast-emulated"
        newRepositoryUrl="https://github.lightfast.localhost/organizations/lightfast-emulated/repositories/new?name=.lightfast"
        orgSlug="acme"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Verify repository" }));

    await waitFor(() => {
      expect(verifyMutationOptionsMock).toHaveBeenCalledWith({
        meta: { errorTitle: "Failed to verify .lightfast" },
      });
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });
});
