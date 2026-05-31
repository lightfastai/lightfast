import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const fetchQueryMock = vi.fn();
const getBySlugQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  queryKey: [["viewer", "organization", "getBySlug"], input],
}));
const bindCardMock = vi.fn(
  ({ githubError, orgSlug }: { githubError?: string; orgSlug: string }) => (
    <div data-github-error={githubError} data-testid="bind-card">
      {orgSlug}
    </div>
  )
);
vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  trpc: {
    viewer: {
      organization: {
        getBySlug: { queryOptions: getBySlugQueryOptionsMock },
      },
    },
  },
}));

// The card is a client component (tRPC + Clerk hooks); stub it so the page
// test stays a pure RSC-gate test.
vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/_components/bind-github-card",
  () => ({
    BindGithubCard: bindCardMock,
  })
);

const { default: BindTaskPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page"
);

function invoke(
  slug = "acme",
  searchParams: { github_error?: string | string[] } = {}
) {
  return BindTaskPage({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  });
}

beforeEach(() => {
  redirectMock.mockClear();
  fetchQueryMock.mockReset();
  getBySlugQueryOptionsMock.mockClear();
  bindCardMock.mockClear();
});

describe("tasks/bind/page — setup page", () => {
  it("renders the bind card for an unbound org", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    const element = await invoke("acme");
    render(element);

    expect(screen.getByTestId("bind-card")).toHaveTextContent("acme");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes known GitHub callback errors to the bind card", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    const element = await invoke("acme", {
      github_error: "github_authorization_denied",
    });
    render(element);

    expect(bindCardMock).toHaveBeenCalledWith(
      {
        githubError: "github_authorization_denied",
        orgSlug: "acme",
      },
      undefined
    );
  });

  it("ignores unknown GitHub callback error codes", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    const element = await invoke("acme", { github_error: "bad_error" });
    render(element);

    expect(screen.getByTestId("bind-card")).not.toHaveAttribute(
      "data-github-error"
    );
  });

  it("redirects a bound org to the GitHub completion page", async () => {
    fetchQueryMock.mockResolvedValue({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/bind/github/complete"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/acme/tasks/bind/github/complete"
    );
  });

  it("redirects orgs that already connected GitHub to the .lightfast task", async () => {
    fetchQueryMock.mockResolvedValue({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/github/lightfast-repo"
    );
  });

  it("redirects a bound org to completion even when a callback error is present", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "bound" });

    await expect(
      invoke("acme", {
        github_error: "org_already_bound",
      })
    ).rejects.toThrow("NEXT_REDIRECT:/acme/tasks/bind/github/complete");

    expect(redirectMock).toHaveBeenCalledWith(
      "/acme/tasks/bind/github/complete"
    );
    expect(bindCardMock).not.toHaveBeenCalled();
  });

  it("loads setup status through the tRPC organization slug access query", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    await invoke("acme");

    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });
});
