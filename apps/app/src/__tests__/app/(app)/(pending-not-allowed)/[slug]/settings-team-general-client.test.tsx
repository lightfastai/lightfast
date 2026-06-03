import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);

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
  useSuspenseQuery: vi.fn(() => ({
    data: [{ initials: "AI", slug: "acme" }],
  })),
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
});

describe("TeamGeneralSettingsClient", () => {
  it("renders the reworked Profile group", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(screen.getByText("Avatar")).toBeVisible();
    expect(screen.getByText("Team name")).toBeVisible();
    expect(screen.getByLabelText("Team name")).toHaveValue("acme");
  });
});
