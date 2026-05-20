import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const requireOrgAccessMock = vi.fn();
vi.mock("~/lib/org-access-clerk", () => ({
  requireOrgAccess: requireOrgAccessMock,
}));

const getOrgBindingGateMock = vi.fn();
vi.mock("~/lib/org-binding-gate", () => ({
  getOrgBindingGate: getOrgBindingGateMock,
}));

// The card is a client component (tRPC + Clerk hooks); stub it so the page
// test stays a pure RSC-gate test.
vi.mock("./_components/bind-github-card", () => ({
  BindGithubCard: ({ orgSlug }: { orgSlug: string }) => (
    <div data-testid="bind-card">{orgSlug}</div>
  ),
}));

const { default: BindTaskPage } = await import("./page");

function invoke(slug = "acme") {
  return BindTaskPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  redirectMock.mockClear();
  requireOrgAccessMock.mockReset();
  getOrgBindingGateMock.mockReset();
  requireOrgAccessMock.mockResolvedValue({ org: { id: "org_1" } });
});

describe("tasks/bind/page — setup page", () => {
  it("renders the bind card for an unbound org", async () => {
    getOrgBindingGateMock.mockResolvedValue({ bindingStatus: "unbound" });

    const element = await invoke("acme");
    render(element);

    expect(screen.getByTestId("bind-card")).toHaveTextContent("acme");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a bound org back to the workspace root", async () => {
    getOrgBindingGateMock.mockResolvedValue({ bindingStatus: "bound" });

    await expect(invoke("acme")).rejects.toThrow("NEXT_REDIRECT:/acme");
    expect(redirectMock).toHaveBeenCalledWith("/acme");
  });
});
