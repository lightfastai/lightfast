import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn();
const reloadMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("@repo/app-trpc/react", () => ({
  useTRPC: () => ({
    org: {
      setup: {
        task: {
          bind: {
            mutationOptions: (options: unknown) => options,
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

vi.mock("@vendor/clerk/client", () => ({
  useSession: () => ({ session: { reload: reloadMock } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

const { BindGithubCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/_components/bind-github-card"
);

beforeEach(() => {
  mutateAsyncMock.mockReset();
  reloadMock.mockReset();
  replaceMock.mockReset();
});

describe("BindGithubCard", () => {
  it("frames setup as an org-level GitHub organization connection", () => {
    render(<BindGithubCard orgSlug="acme" />);

    const heading = screen.getByRole("heading", {
      name: "Connect a GitHub organization",
    });
    const description = screen.getByText(
      "Bind one GitHub organization to this Lightfast team so the workspace has an org-level source-control connection."
    );
    const connectButton = screen.getByRole("button", {
      name: "Connect GitHub organization",
    });

    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("pb-4");
    expect(description.parentElement).toContainElement(connectButton);
    expect(screen.getByText("lightfast.ai/acme")).toBeInTheDocument();
    expect(screen.getByText("GitHub organization")).toBeInTheDocument();
    expect(screen.queryByText("Lightfast team")).not.toBeInTheDocument();
    expect(screen.queryByText("Provider")).not.toBeInTheDocument();
    expect(connectButton).toBeInTheDocument();
  });

  it("keeps the existing bind mutation flow", async () => {
    mutateAsyncMock.mockResolvedValue({ ok: true, bindingStatus: "bound" });
    reloadMock.mockResolvedValue(undefined);

    render(<BindGithubCard orgSlug="acme" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Connect GitHub organization",
      })
    );

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/acme");
    });
  });
});
