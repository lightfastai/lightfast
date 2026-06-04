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
const connectorsListQueryOptionsMock = vi.fn(() => ({
  queryKey: [["org", "workspace", "connectors", "list"]],
}));
const xSetupClientMock = vi.fn(({ orgSlug }: { orgSlug: string }) => (
  <div data-testid="x-setup-client">{orgSlug}</div>
));

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  trpc: {
    org: {
      workspace: {
        connectors: {
          list: { queryOptions: connectorsListQueryOptionsMock },
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
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/connectors/x/_components/x-connector-setup-client",
  () => ({ XConnectorSetupClient: xSetupClientMock })
);

const { default: XConnectorSetupPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/connectors/x/page"
);

function invoke(slug = "acme") {
  return XConnectorSetupPage({
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  redirectMock.mockClear();
  fetchQueryMock.mockReset();
  getBySlugQueryOptionsMock.mockClear();
  connectorsListQueryOptionsMock.mockClear();
  xSetupClientMock.mockClear();
});

describe("tasks/connectors/x/page", () => {
  it("redirects to the earlier setup requirement when X is not next", async () => {
    fetchQueryMock.mockResolvedValueOnce({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/github/lightfast-repo"
    );
  });

  it("redirects fully bound orgs through X completion for session refresh", async () => {
    fetchQueryMock.mockResolvedValueOnce({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/connectors/x/complete"
    );
  });

  it("prefetches connectors and renders the X setup client when X is required", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        bindingStatus: "unbound",
        nextSetupRequirement: "x_connector",
      })
      .mockResolvedValueOnce([]);

    const element = await invoke("acme");
    render(element);

    expect(screen.getByTestId("x-setup-client")).toHaveTextContent("acme");
    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
    expect(connectorsListQueryOptionsMock).toHaveBeenCalled();
    expect(xSetupClientMock).toHaveBeenCalledWith(
      { orgSlug: "acme" },
      undefined
    );
  });
});
