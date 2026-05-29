import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsyncMock = vi.fn();
const reloadMock = vi.fn();
const replaceMock = vi.fn();
const startMutationOptionsMock = vi.fn((options: unknown) => options);
const assignMock = vi.fn();

Object.defineProperty(window, "location", {
  value: { assign: assignMock },
  writable: true,
});

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      setup: {
        github: {
          start: {
            mutationOptions: startMutationOptionsMock,
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

const { BindGithubCard } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/_components/bind-github-card"
);

beforeEach(() => {
  mutateAsyncMock.mockReset();
  reloadMock.mockReset();
  replaceMock.mockReset();
  startMutationOptionsMock.mockClear();
  assignMock.mockReset();
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

  it("starts the GitHub installation flow and navigates externally", async () => {
    mutateAsyncMock.mockResolvedValue({
      installationUrl:
        "https://github.lightfast.localhost/apps/lightfast-local/installations/new?state=abc",
    });

    render(<BindGithubCard orgSlug="acme" />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Connect GitHub organization",
      })
    );

    await waitFor(() => {
      expect(startMutationOptionsMock).toHaveBeenCalledWith({
        meta: { errorTitle: "Failed to connect GitHub" },
      });
      expect(mutateAsyncMock).toHaveBeenCalledWith({ orgSlug: "acme" });
      expect(assignMock).toHaveBeenCalledWith(
        "https://github.lightfast.localhost/apps/lightfast-local/installations/new?state=abc"
      );
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("surfaces GitHub callback errors", () => {
    render(
      <BindGithubCard githubError="github_authorization_denied" orgSlug="acme" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "GitHub authorization was cancelled. Start the connection again when you are ready."
    );
  });
});
