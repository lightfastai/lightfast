import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        organization: {
          updateName: {
            mutationOptions: updateNameMutationOptionsMock,
          },
        },
      },
    },
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: listUserOrganizationsQueryOptionsMock,
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@vendor/clerk", () => ({
  useOrganizationList: () => ({
    setActive: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

beforeEach(() => {
  listUserOrganizationsQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockImplementation(() => ({
    data: [{ initials: "AI", slug: "acme" }],
  }));
});

describe("TeamGeneralSettingsClient", () => {
  it("renders the team profile form for the active organization", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(listUserOrganizationsQueryOptionsMock).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "General" })).toBeVisible();
    expect(screen.getByText("Profile")).toBeVisible();
    expect(screen.getByText("AI")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveValue("acme");
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });

  it("no longer renders source-control sections on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(screen.queryByText("Source control")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Repositories" })).toBeNull();
  });
});
