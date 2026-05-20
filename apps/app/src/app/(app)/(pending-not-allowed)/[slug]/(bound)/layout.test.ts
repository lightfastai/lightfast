import { beforeEach, describe, expect, it, vi } from "vitest";

// `redirect()` halts rendering by throwing in Next.js — model that here so
// code after the redirect never runs.
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

const { default: BoundLayout } = await import("./layout");

function invoke(slug = "acme") {
  return BoundLayout({
    children: "workspace-children",
    params: Promise.resolve({ slug }),
  });
}

beforeEach(() => {
  redirectMock.mockClear();
  requireOrgAccessMock.mockReset();
  getOrgBindingGateMock.mockReset();
  requireOrgAccessMock.mockResolvedValue({ org: { id: "org_1" } });
});

describe("(bound)/layout — product setup gate", () => {
  it("redirects an unbound org to /[slug]/tasks/bind", async () => {
    getOrgBindingGateMock.mockResolvedValue({ bindingStatus: "unbound" });

    await expect(invoke("acme")).rejects.toThrow(
      "NEXT_REDIRECT:/acme/tasks/bind"
    );
    expect(redirectMock).toHaveBeenCalledWith("/acme/tasks/bind");
  });

  it("renders the workspace for a bound org", async () => {
    getOrgBindingGateMock.mockResolvedValue({ bindingStatus: "bound" });

    const result = await invoke("acme");

    expect(result).toBe("workspace-children");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("gates on the DB binding for the org id resolved by requireOrgAccess", async () => {
    requireOrgAccessMock.mockResolvedValue({ org: { id: "org_resolved" } });
    getOrgBindingGateMock.mockResolvedValue({ bindingStatus: "bound" });

    await invoke("acme");

    expect(getOrgBindingGateMock).toHaveBeenCalledWith("org_resolved");
  });
});
