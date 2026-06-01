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
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: [["org", "settings", "sourceControl", "listRepositories"]],
}));
const repoClientMock = vi.fn(
  ({ accountLogin, orgSlug }: { accountLogin: string; orgSlug: string }) => (
    <div data-account-login={accountLogin} data-testid="repo-client">
      {orgSlug}
    </div>
  )
);

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  trpc: {
    org: {
      settings: {
        sourceControl: {
          listRepositories: {
            queryOptions: sourceControlListRepositoriesQueryOptionsMock,
          },
        },
      },
    },
    viewer: {
      organization: {
        getBySlug: { queryOptions: getBySlugQueryOptionsMock },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/github/lightfast-repo/_components/lightfast-repo-setup-client",
  () => ({ LightfastRepoSetupClient: repoClientMock })
);

const { default: LightfastRepoSetupPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/github/lightfast-repo/page"
);

function invoke(slug = "acme") {
  return LightfastRepoSetupPage({
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  redirectMock.mockClear();
  fetchQueryMock.mockReset();
  getBySlugQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  repoClientMock.mockClear();
});

describe("tasks/github/lightfast-repo/page", () => {
  it("redirects to GitHub org setup when that requirement is still missing", async () => {
    fetchQueryMock.mockResolvedValueOnce({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/bind"
    );
  });

  it("redirects fully bound orgs through completion for session refresh", async () => {
    fetchQueryMock.mockResolvedValueOnce({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/bind/github/complete"
    );
  });

  it("renders the repo setup client for orgs missing .lightfast", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        bindingStatus: "unbound",
        nextSetupRequirement: "github_lightfast_repo",
      })
      .mockResolvedValueOnce({
        binding: null,
        organization: {
          id: "987654",
          installationManageUrl:
            "https://github.com/apps/lightfast/installations/1001",
          login: "acme-live",
        },
        repositories: [],
        repositoriesError: null,
        status: "bound",
      });

    const element = await invoke("acme");
    render(element);

    expect(screen.getByTestId("repo-client")).toHaveTextContent("acme");
    expect(screen.getByTestId("repo-client")).toHaveAttribute(
      "data-account-login",
      "acme-live"
    );
    expect(repoClientMock).toHaveBeenCalledWith(
      { accountLogin: "acme-live", orgSlug: "acme" },
      undefined
    );
  });

  it("renders a non-bouncing fallback when live GitHub organization data is unavailable", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        bindingStatus: "unbound",
        nextSetupRequirement: "github_lightfast_repo",
      })
      .mockResolvedValueOnce({
        binding: null,
        organization: null,
        repositories: [],
        repositoriesError: null,
        status: "bound",
      });

    const element = await invoke("acme");
    render(element);

    expect(
      screen.getByRole("heading", {
        name: "GitHub organization details could not be refreshed",
      })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Refresh this page to try again, or return to settings while GitHub details are unavailable."
      )
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Retry" })).toHaveAttribute(
      "href",
      "/acme/tasks/github/lightfast-repo"
    );
    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
      "href",
      "/acme/settings"
    );
    expect(redirectMock).not.toHaveBeenCalledWith("/acme/tasks/bind");
    expect(repoClientMock).not.toHaveBeenCalled();
  });
});
