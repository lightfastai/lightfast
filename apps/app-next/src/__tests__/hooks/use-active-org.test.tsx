import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/lightfast/signals";
const useQueryMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: () => ({
            queryKey: ["viewer", "organization", "listUserOrganizations"],
          }),
        },
      },
    },
  }),
}));

const { useActiveOrg } = await import("~/hooks/use-active-org");

const orgs = [
  { id: "org_1", initials: "L", name: "Lightfast", slug: "lightfast" },
  { id: "org_2", initials: "AC", name: "Acme", slug: "acme" },
];

describe("useActiveOrg", () => {
  beforeEach(() => {
    pathname = "/lightfast/signals";
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({ data: orgs });
  });

  it("resolves the org that matches the first path segment", () => {
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toEqual({
      id: "org_1",
      initials: "L",
      name: "Lightfast",
      slug: "lightfast",
    });
  });

  it("returns null on reserved routes", () => {
    pathname = "/account/settings";
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toBeNull();
  });

  it("returns null while the org list is still loading", () => {
    useQueryMock.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useActiveOrg());
    expect(result.current).toBeNull();
  });
});
