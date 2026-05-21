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
vi.mock("@repo/app-trpc/server", () => ({
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
    BindGithubCard: ({ orgSlug }: { orgSlug: string }) => (
      <div data-testid="bind-card">{orgSlug}</div>
    ),
  })
);

const { default: BindTaskPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/tasks/bind/page"
);

function invoke(slug = "acme") {
  return BindTaskPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  redirectMock.mockClear();
  fetchQueryMock.mockReset();
  getBySlugQueryOptionsMock.mockClear();
});

describe("tasks/bind/page — setup page", () => {
  it("renders the bind card for an unbound org", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    const element = await invoke("acme");
    render(element);

    expect(screen.getByTestId("bind-card")).toHaveTextContent("acme");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a bound org back to the workspace root", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "bound" });

    await expect(invoke("acme")).rejects.toThrow("NEXT_REDIRECT:/acme");
    expect(redirectMock).toHaveBeenCalledWith("/acme");
  });

  it("loads setup status through the tRPC organization slug access query", async () => {
    fetchQueryMock.mockResolvedValue({ bindingStatus: "unbound" });

    await invoke("acme");

    expect(getBySlugQueryOptionsMock).toHaveBeenCalledWith({ slug: "acme" });
  });
});
